import fs from "fs";

const urls = [
  "/",
  "/#funcionalidades",
  "/#planos",
  "/#faq"
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.map(url=>`
<url>
<loc>https://www.registraponto.app.br${url}</loc>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
</url>
`).join("")}

</urlset>`;

fs.writeFileSync("./public/sitemap.xml", xml);

console.log("Sitemap criado com sucesso");