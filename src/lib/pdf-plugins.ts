import { ellipse, image, line, rectangle, table, text } from "@pdfme/schemas";

// @pdfme/schemas' own `builtInPlugins` export only registers the Text
// plugin — every other built-in (rectangle, line, image, table, ...) has to
// be added explicitly, or both the Designer UI and @pdfme/generator's
// `generate()` throw "<type> of template.schemas is not found in plugins"
// the moment a template uses one.
//
// Deliberately excludes the built-ins none of our document types need:
// Signature (pulls in the signature_pad library), SVG, Date/DateTime/Time
// pickers, Select/Checkbox/RadioGroup/MultiVariableText (interactive PDF
// form fields), and all 12 barcode formats. Those made the designer page's
// bundle multiple megabytes larger for capabilities this app has no use
// for. Add one back here (and only here — both the designer and the
// generate path import from this single file) if a real document type ever
// needs it.
export const PDF_PLUGINS = {
  Text: text,
  Image: image,
  Table: table,
  Rectangle: rectangle,
  Ellipse: ellipse,
  Line: line,
};
