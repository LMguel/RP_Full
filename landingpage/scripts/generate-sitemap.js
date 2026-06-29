import fs from "fs";

const today = new Date().toISOString().split("T")[0];

const urls = [
  { path: "/",                  priority: "1.0", changefreq: "weekly" },
  { path: "/#funcionalidades",  priority: "0.8", changefreq: "monthly" },
  { path: "/#planos",           priority: "0.9", changefreq: "weekly" },
  { path: "/#faq",              priority: "0.6", changefreq: "monthly" },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ path, priority, changefreq }) => `  <url>
    <loc>https://www.registraponto.app.br${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>`;

fs.writeFileSync("./public/sitemap.xml", xml);
console.log("Sitemap criado com sucesso:", today);
