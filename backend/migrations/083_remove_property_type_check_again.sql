-- Migration 083: Remove property_type check constraint (again)
-- Migration 082 re-added a constraint that is too restrictive.
-- The application handles normalization in PropertyService.normalizePropertyTypeToJapanese()
-- so the DB constraint is unnecessary and causes save failures for values like '他', '収益', '商業用'.

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;

-- Allow any text value for property_type
COMMENT ON COLUMN properties.property_type IS 'Property type - free text, normalized by application layer';
