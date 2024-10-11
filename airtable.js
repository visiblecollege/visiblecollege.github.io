require('dotenv').config();

const Airtable = require('airtable');
const fs = require('fs');
const fsPromises = require('fs').promises;
const axios = require('axios');
const path = require('path');
const yaml = require('js-yaml');

// Configure Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const tableId = process.env.AIRTABLE_TABLE_ID;
const fieldsToFetch = ['Name', 'id', 'Website Category', 'Team?', 'Photo', 'Team Bio', 'Research Bio', 'Website Title'];

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


async function downloadAndSavePhoto(photoData) {
    if (photoData && photoData.length > 0) {
        const photo = photoData[0];
        const url = photo.url;
        const filename = photo.filename;

        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(path.join(__dirname, filename));
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('Error downloading photo:', error);
        }
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
        await fsPromises.copyFile(oldPath, newPath);
        await fsPromises.rm(oldPath);
        console.log(`Moved photo: ${item.Photo[0].filename} from ${oldPath} to ${newPath}`);
      } catch (error) {
        console.error(`Error moving photo ${item.Photo[0].filename}:`, error);
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
fetchFieldsFromTable(tableId, fieldsToFetch)
  .then(data => {
    console.log(data);
    return Promise.all(data.map(async (item) => {
      if (item.Photo) {
        await downloadAndSavePhoto(item.Photo);
        console.log(`Downloaded and saved: ${item.Photo[0].filename}`);
      }
    })).then(() => generateProfilesYaml(data));
  })
  .then(() => {
    console.log('Process completed successfully');
  })
  .catch(error => {
    console.error('Failed to process data:', error);
  });

