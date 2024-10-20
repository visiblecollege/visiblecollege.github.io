require('dotenv').config();

const path = require('path');
const Airtable = require('airtable');
const fs = require('fs');
const fsPromises = require('fs').promises;
const axios = require('axios');
const yaml = require('js-yaml');

// Configure Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const peopleTableId = process.env.AIRTABLE_PEOPLE_TABLE_ID;
const peopleFieldsToFetch = ['Name', 'id', 'Website Category', 'Photo', 'Research Bio', 'Website Title', 'Profile Page Content'];
const resourcesTableId = process.env.AIRTABLE_RESOURCES_TABLE_ID;
const resourcesFieldsToFetch = ['id', 'website', 'author_name', 'author_id', 'type', 'abbr', 'thumbnail', 'title', 'publisher', 'year', 'video', 'doi', 'tags', 'pdf', 'abstract', 'note'];

// Function to fetch specific fields from a table
async function fetchFieldsFromTable(tableId, fields, formula = '') {
  const options = { fields: fields };
  if (formula) options.filterByFormula = formula;
  try {
    const records = await base(tableId).select(options).all();

    const data = records.map(record => {
      const obj = {};
      fields.forEach(field => {
        obj[field] = record.get(field);
      });
      return obj;
    });

    return data;
  } catch (error) {
    console.error('Error fetching data from Airtable:', error);
    throw error;
  }
}

async function downloadAndSaveFile(url, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

async function generateProfilesYaml(data) {
  const profiles = {
    groups: [
      {
        label: "Research Associates",
        summary: "Academics and professionals who are working or have worked on research projects or other initiatives of The Visible College.",
        members: []
      },
      {
        label: "Public Figures",
        summary: "Scholars working publicly in UAP Studies or adjacent fields who are not directly associated with The Visible College, but whose work we consider integral to an understanding of the subject area as a whole.",
        members: []
      }
    ]
  };

  const photoDownloadPromises = [];
  const bioWritePromises = [];
  const memberProcessingPromises = [];
  const profilePagePromises = [];

  for (const item of data) {
    memberProcessingPromises.push((async () => {
      const member = {
        name: item.Name,
        id: item.id,
        title: item['Website Title'],
        image: item.Photo ? `${item.id}${path.extname(item.Photo[0].filename)}` : undefined
      };

      if (item['Profile Page Content']) {
        member.profile_page = `people/${item.id}`;
      }

      if (item.Photo && item.Photo.length > 0) {
        const extension = path.extname(item.Photo[0].filename) || '.jpg';
        const newPath = path.join(__dirname, '..', 'assets', 'img', `${item.id}${extension}`);

        photoDownloadPromises.push(
          downloadAndSaveFile(item.Photo[0].url, newPath)
            .then(() => console.log(`Downloaded and moved photo: ${item.Photo[0].filename} to ${newPath}`))
            .catch(error => console.error(`Error processing photo ${item.Photo[0].filename}:`, error))
        );
      }

      if (item['Website Category']?.toLowerCase()?.includes('research associate')) {
        member.bio = `people/bio/${item.id}.md`;
        profiles.groups[0].members.push(member);

        const bioPath = path.join(__dirname, '..', '_pages', 'people', 'bio', `${item.id}.md`);
        bioWritePromises.push(
          fsPromises.writeFile(bioPath, item['Research Bio'] || '', 'utf8')
            .then(() => console.log(`Created bio file for ${item.Name} at ${bioPath}`))
            .catch(error => console.error(`Error writing bio file for ${item.Name}:`, error))
        );
      } else if (item['Website Category']?.toLowerCase()?.includes('public figure')) {
        profiles.groups[1].members.push(member);
      }

      if (item['Profile Page Content']) {
        const profilePageContent = `---
layout: profile
title: ${item.Name}
description:
permalink: /people/${item.id}

profile:
    name: ${item.Name}
    id: ${item.id}
    align: left
    title: ${item['Website Title'] || ''}
    image: ${member.image || ''}
---

${item['Profile Page Content']}
`;

        const profilePagePath = path.join(__dirname, '..', '_pages', 'people', `${item.id}.md`);
        profilePagePromises.push(
          fsPromises.writeFile(profilePagePath, profilePageContent, 'utf8')
            .then(() => console.log(`Created profile page for ${item.Name} at ${profilePagePath}`))
            .catch(error => console.error(`Error writing profile page for ${item.Name}:`, error))
        );
      }
    })());
  }

  await Promise.all(memberProcessingPromises);

  // Sort members by first name
  profiles.groups.forEach(group => {
    group.members.sort((a, b) => a.name.localeCompare(b.name));
  });

  const yamlStr = yaml.dump(profiles, { lineWidth: -1 });

  const yamlWritePromise = fsPromises.writeFile(path.join(__dirname, '..','_data', 'profiles.yml'), yamlStr, 'utf8')
    .then(() => console.log('Generated profiles.yml successfully'))
    .catch(error => console.error('Error writing profiles.yml:', error));

  // Wait for all parallel operations to complete
  await Promise.all([
    ...photoDownloadPromises,
    ...bioWritePromises,
    ...profilePagePromises,
    yamlWritePromise
  ]);
}

const getPeople = () => fetchFieldsFromTable(peopleTableId, peopleFieldsToFetch, "NOT({Website Category} = '')")
  .then(generateProfilesYaml)
  .then(() => {
    console.log('Process completed successfully');
  })
  .catch(error => {
    console.error('Failed to process data:', error);
  });


const getResources = () => fetchFieldsFromTable(resourcesTableId, resourcesFieldsToFetch)
  .then(async data => {
    console.log('Fetched resources data:', data, null, 2);

    // Process the data
    const processedData = data.map(item => {
      return {
        type: item.type,
        id: item.id,
        abbr: item.abbr,
        video: item.video,
        website: item.website,
        pdf: item.pdf,
        author: item.author_name ? item.author_name.join(' and ') : undefined,
        author_id: item.author_id ? `|${item.author_id.join('|')}|` : undefined,
        title: item.title,
        year: item.year,
        journal: item.journal,
        volume: item.volume,
        number: item.number,
        pages: item.pages,
        publisher: item.publisher,
        doi: item.doi,
        tags: item.tags ? `|${item.tags.join('|')}|` : undefined,
        preview: item.thumbnail ? `${item.id}${path.extname(item.thumbnail[0].filename)}` : undefined,
        thumbnailUrl: item.thumbnail ? item.thumbnail[0].url : undefined,
        note: item.note
      }
    });

    // Download and save thumbnails
    await Promise.all(processedData.map(async (item) => {
      if (item.preview) {
        const extension = path.extname(item.preview) || '.jpg';
        const thumbnailPath = path.join(__dirname, '..', 'assets', 'img', 'publication_preview', `${item.id}${extension}`);

        try {
          await downloadAndSaveFile(item.thumbnailUrl, thumbnailPath);
          console.log(`Downloaded and saved thumbnail: ${item.id}${extension}`);
        } catch (error) {
          console.error(`Error downloading thumbnail for ${item.id}:`, error);
        }
      }
    }));

    // Generate BibTeX entries
    const bibEntries = processedData.map(item => {
      let entry = `@${item.type}{${item.id},\n`;
      entry += `  title = {${item.title}},\n`;
      if (item.abbr) entry += `  abbr = {${item.abbr}},\n`;
      if (item.author) entry += `  author = {${item.author}},\n`;
      if (item.author_id) entry += `  author_id = {${item.author_id}},\n`;
      if (item.year) entry += `  year = {${item.year}},\n`;
      if (item.journal) entry += `  journal = {${item.journal}},\n`;
      if (item.volume) entry += `  volume = {${item.volume}},\n`;
      if (item.number) entry += `  number = {${item.number}},\n`;
      if (item.pages) entry += `  pages = {${item.pages}},\n`;
      if (item.publisher) entry += `  publisher = {${item.publisher}},\n`;
      if (item.doi) entry += `  doi = {${item.doi}},\n`;
      if (item.url) entry += `  url = {${item.url}},\n`;
      if (item.preview) entry += `  preview = {${item.preview}},\n`;
      if (item.tags) entry += `  tags = {${item.tags}},\n`;
      if (item.video) entry += `  video = {${item.video}},\n`;
      if (item.pdf) entry += `  pdf = {${item.pdf}},\n`;
      if (item.website) entry += `  website = {${item.website}},\n`;
      if (item.abstract) entry += `  abstract = {${item.abstract}},\n`;
      if (item.note) entry += `  note = {${item.note}},\n`;
      entry += `}\n\n`;
      return entry;
    }).join('');

    // Write to papers.bib
    try {
      await fsPromises.writeFile(path.join(__dirname, '..', '_bibliography', 'papers.bib'), bibEntries, 'utf8');
      console.log('Generated papers.bib successfully');
    } catch (error) {
      console.error('Error writing papers.bib:', error);
    }
  })
  .catch(error => {
    console.error('Error fetching data from Airtable:', error);
  });

Promise.all([
  getPeople(),
  getResources()
])