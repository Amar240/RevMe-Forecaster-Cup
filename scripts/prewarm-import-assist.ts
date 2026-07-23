import { columnMappingSchema, explanationOutputSchema, repairOutputSchema, TEAM_IMPORT_CANONICAL_FIELDS } from '../src/lib/team-import/assist'
import { invokeImportAssist } from '../src/server/import-assist'
import { importAssistStructuredSchemas } from '../src/server/roster-import-assist'

async function main() {
  const results = await Promise.all([
    invokeImportAssist({ system: 'Map this synthetic roster header. Never invent workbook content.', input: { rows: [['University', 'Team ID', 'First name', 'Last name', 'Email', 'Team name']], canonicalFields: TEAM_IMPORT_CANONICAL_FIELDS }, schema: columnMappingSchema, jsonSchema: importAssistStructuredSchemas.mapping, schemaName: 'roster_column_mapping' }),
    invokeImportAssist({ system: 'Explain this synthetic validation diagnostic concisely.', input: { diagnostics: [{ code: 'PERSON_EMAIL_MALFORMED', severity: 'ERROR', scope: 'PERSON' }] }, schema: explanationOutputSchema, jsonSchema: importAssistStructuredSchemas.explanation, schemaName: 'roster_issue_explanation' }),
    invokeImportAssist({ system: 'Return conservative repairs for supplied fields.', input: { fields: [] }, schema: repairOutputSchema, jsonSchema: importAssistStructuredSchemas.repair, schemaName: 'roster_field_repairs' }),
  ])
  if (results.some((result) => result === null)) throw new Error('One or more import-assist schemas could not be prewarmed')
  console.log('Import-assist structured-output schemas are ready.')
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Import-assist prewarm failed'); process.exitCode = 1 })
