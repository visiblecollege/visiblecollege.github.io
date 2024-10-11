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
const peopleFieldsToFetch = ['Name', 'id', 'Website Category', 'Team?', 'Photo', 'Team Bio', 'Research Bio', 'Website Title'];
const resourcesTableId = process.env.AIRTABLE_RESOURCES_TABLE_ID;
const resourcesFieldsToFetch = ['id', 'website', 'author_name', 'author_id', 'type', 'abbr', 'thumbnail', 'title', 'publisher', 'year', 'video', 'doi', 'tags', 'pdf', 'abstract', 'note'];

// Function to fetch specific fields from a table
async function fetchFieldsFromTable(tableId, fields) {
  try {
    const records = await base(tableId).select({
      fields: fields
    }).all();

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
        research_associates: {
          label: "Research Associates",
          summary: "Academics and professionals who are working or have worked on research projects or other initiatives of The Visible College.",
          members: []
        }
      },
      {
        public_figures: {
          label: "Public Figures",
          summary: "Scholars working publicly in UAP Studies or adjacent fields who are not directly associated with The Visible College, but whose work we consider integral to an understanding of the subject area as a whole.",
          members: []
        }
      }
    ]
  };

  for (const item of data) {
    if (item.Photo && item.Photo.length > 0) {
      const oldPath = path.join(__dirname, item.Photo[0].filename);
      const newPath = path.join(__dirname, 'assets', 'img', item.Photo[0].filename);

      try {
        await downloadAndSaveFile(item.Photo[0].url, oldPath);
        await fsPromises.copyFile(oldPath, newPath);
        await fsPromises.rm(oldPath);
        console.log(`Downloaded and moved photo: ${item.Photo[0].filename} to ${newPath}`);
      } catch (error) {
        console.error(`Error processing photo ${item.Photo[0].filename}:`, error);
      }
    }
    const member = {
      name: item.Name,
      id: item.id,
      title: item['Website Title'],
      image: item.Photo ? item.Photo[0].filename : ''
    };

    // Add bio field only for research associates
    if (item['Website Category'].toLowerCase().includes('research associate')) {
      member.bio = `people/bio/${item.id}.md`;
      profiles.groups[0].research_associates.members.push(member);

      // Write Research Bio to markdown file
      try {
        const bioPath = path.join(__dirname, '_pages', 'people', 'bio', `${item.id}.md`);
        await fsPromises.writeFile(bioPath, item['Research Bio'] || '', 'utf8');
        console.log(`Created bio file for ${item.Name} at ${bioPath}`);
      } catch (error) {
        console.error(`Error writing bio file for ${item.Name}:`, error);
      }
    } else {
      profiles.groups[1].public_figures.members.push(member);
    }
  }

  // Sort members by first name
  profiles.groups.forEach(group => {
    const key = Object.keys(group)[0];
    group[key].members.sort((a, b) => a.name.localeCompare(b.name));
  });

  const yamlStr = yaml.dump(profiles, { lineWidth: -1 });

  try {
    await fsPromises.writeFile(path.join(__dirname, '_data', 'profiles.yml'), yamlStr, 'utf8');
    console.log('Generated profiles.yml successfully');
  } catch (error) {
    console.error('Error writing profiles.yml:', error);
  }
}

// Modify the existing code to call the new function
// fetchFieldsFromTable(peopleTableId, peopleFieldsToFetch)
//   .then(data => {
//     console.log(data);
//     return Promise.all(data.map(async (item) => {
//       if (item.Photo) {
//         await downloadAndSaveFile(item.Photo[0].url, path.join(__dirname, item.Photo[0].filename));
//         console.log(`Downloaded and saved: ${item.Photo[0].filename}`);
//       }
//     })).then(() => generateProfilesYaml(data));
//   })
//   .then(() => {
//     console.log('Process completed successfully');
//   })
//   .catch(error => {
//     console.error('Failed to process data:', error);
//   });


fetchFieldsFromTable(resourcesTableId, resourcesFieldsToFetch)
  .then(async data => {
    console.log('Fetched resources data:', JSON.stringify(data, null, 2));

    // Process the data
    const processedData = data.map(item => ({
      id: item.id,
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
      url: item.url,
      tags: item.tags ? `|${item.tags.join('|')}|` : undefined,
      preview: item.thumbnail ? `${item.id}${path.extname(item.thumbnail[0].filename)}` : undefined, // Convert thumbnail to preview with correct file extension
    }));

    // Download and save thumbnails
    await Promise.all(processedData.map(async (item) => {
      if (item.preview) {
        const thumbnailUrl = data.find(d => d.id === item.id).thumbnail[0].url;
        const thumbnailPath = path.join(__dirname, 'assets', 'img', 'publication_preview', `${item.id}.jpg`);

        try {
          await downloadAndSaveFile(thumbnailUrl, thumbnailPath);
          console.log(`Downloaded and saved thumbnail: ${item.id}.jpg`);
        } catch (error) {
          console.error(`Error downloading thumbnail for ${item.id}:`, error);
        }
      }
    }));

    // Generate BibTeX entries
    const bibEntries = processedData.map(item => {
      let entry = `@${item.type}{${item.id},\n`;
      if (item.author) entry += `  author = {${item.author}},\n`;
      if (item.author_id) entry += `  author_id = {${item.author_id}},\n`;
      entry += `  title = {${item.title}},\n`;
      entry += `  year = {${item.year}},\n`;
      if (item.journal) entry += `  journal = {${item.journal}},\n`;
      if (item.volume) entry += `  volume = {${item.volume}},\n`;
      if (item.number) entry += `  number = {${item.number}},\n`;
      if (item.pages) entry += `  pages = {${item.pages}},\n`;
      if (item.publisher) entry += `  publisher = {${item.publisher}},\n`;
      if (item.doi) entry += `  doi = {${item.doi}},\n`;
      if (item.url) entry += `  url = {${item.url}},\n`;
      if (item.preview) entry += `  preview = {${item.preview}},\n`;
      if (item.tags) entry += `  tags = {${item.tags}},\n`;
      entry += `}\n\n`;
      return entry;
    }).join('');

    // Write to papers.bib
    try {
      await fsPromises.writeFile(path.join(__dirname, '_bibliography', 'papers.bib'), bibEntries, 'utf8');
      console.log('Generated papers.bib successfully');
    } catch (error) {
      console.error('Error writing papers.bib:', error);
    }
  })
  .catch(error => {
    console.error('Error fetching data from Airtable:', error);
  });