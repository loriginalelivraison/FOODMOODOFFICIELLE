import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Rebuild the searchable catalog after replacing data/export.geojson.
const source = fileURLToPath(new URL("../data/export.geojson", import.meta.url));
const target = fileURLToPath(new URL("../src/data/osmDestinations.js", import.meta.url));
const collection = JSON.parse(readFileSync(source, "utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
  throw new Error("Le fichier doit contenir une collection GeoJSON de points.");
}

const entries = [];
const ids = new Set();
for (const feature of collection.features) {
  const props = feature.properties || {};
  const coordinates = feature.geometry?.coordinates;
  const id = feature.id || props["@id"];
  const name = String(props.name || "").trim();
  if (!id || !name || feature.geometry?.type !== "Point" || !Array.isArray(coordinates)) continue;
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
  if (ids.has(id)) continue;
  ids.add(id);
  entries.push({
    id: `osm:${id}`,
    name,
    name_fr: String(props["name:fr"] || "").trim(),
    name_ar: String(props["name:ar"] || "").trim(),
    latitude,
    longitude,
    category: String(props.place || props.amenity || props.shop || props.tourism || props.healthcare || "lieu"),
    city: String(props["addr:city"] || props["addr:state"] || "").trim(),
    street: String(props["addr:street"] || "").trim(),
  });
}

writeFileSync(target, `// Généré depuis data/export.geojson par scripts/import-geojson.mjs.\nexport default ${JSON.stringify(entries)};\n`, "utf8");
console.log(`${entries.length} lieux enregistrés dans ${target}`);
