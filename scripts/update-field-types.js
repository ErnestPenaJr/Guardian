import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Updating field types in the database...');

  // Field types to match the reference image
  const fieldTypes = [
    { id: 1, name: 'Text', description: 'Single line text input', sortOrder: 1 },
    { id: 2, name: 'Paragraph', description: 'Multi-line text input', sortOrder: 2 },
    { id: 3, name: 'Number', description: 'Numeric input', sortOrder: 3 },
    { id: 4, name: 'DropDown', description: 'Dropdown selection', sortOrder: 4 },
    { id: 5, name: 'Radio', description: 'Radio button selection', sortOrder: 5 },
    { id: 6, name: 'CheckBox', description: 'Checkbox selection', sortOrder: 6 },
    { id: 7, name: 'Date', description: 'Date selection', sortOrder: 7 }
  ];

  // Update each field type in the database
  for (const type of fieldTypes) {
    await prisma.fIELD_TYPE.upsert({
      where: { FIELD_TYPE_ID: type.id },
      update: {
        FIELD_TYPE_DESC: type.name,
        SORT_ORDER: type.sortOrder
      },
      create: {
        FIELD_TYPE_ID: type.id,
        FIELD_TYPE_DESC: type.name,
        SORT_ORDER: type.sortOrder
      }
    });
    console.log(`Updated field type: ${type.name}`);
  }

  console.log('Field types updated successfully!');
}

main()
  .catch(e => {
    console.error('Error updating field types:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
