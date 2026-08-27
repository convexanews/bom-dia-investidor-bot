const fs = require('fs');
const path = require('path');
const { renderizarTemplate } = require('./renderizar_template.cjs');

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function titleSize(text, story) {
  const length = String(text || '').length, base = story ? 76 : 72;
  if (length > 115) return Math.round(base * .66);
  if (length > 85) return Math.round(base * .76);
  if (length > 55) return Math.round(base * .88);
  return base;
}

async function renderStudioSlide(project, index, output) {
  const slide = project.slides[index];
  if (!slide) throw new Error(`Slide ${index + 1} não encontrado.`);
  const story = project.format === 'story' || project.format === 'reel';
  let html = fs.readFileSync(path.join(__dirname, 'studio-slide-cloud.html'), 'utf8');
  const values = {
    COLOR_A: slide.colorA || '#071d18', COLOR_B: slide.colorB || '#0c4b38', ACCENT: slide.accent || '#d9aa43',
    IMAGE_URL: String(slide.image || '').replace(/"/g, '%22'), FORMAT_CLASS: story ? 'story' : 'feed',
    CATEGORY: escapeHtml(slide.category), COUNTER: project.slides.length > 1 ? `${index + 1}/${project.slides.length}` : '',
    IMAGE_CREDIT: escapeHtml(slide.imageCredit), HEADLINE: escapeHtml(slide.headline), BODY: escapeHtml(slide.body),
    SOURCE: escapeHtml(slide.source), CTA: escapeHtml(slide.cta), TITLE_SIZE: titleSize(slide.headline, false),
    STORY_TITLE_SIZE: titleSize(slide.headline, true),
  };
  for (const [key, value] of Object.entries(values)) html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  return renderizarTemplate({ html, saida: output, largura: 1080, altura: story ? 1920 : 1350, nome: `studio_cloud_${project.format}_${index + 1}` });
}

async function renderStudioProject(project, outputDir, prefix = `studio-${Date.now()}`) {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = [];
  for (let index = 0; index < project.slides.length; index++) {
    const file = path.join(outputDir, `${prefix}-slide${index + 1}.png`);
    await renderStudioSlide(project, index, file); files.push(file);
  }
  return files;
}

module.exports = { escapeHtml, titleSize, renderStudioSlide, renderStudioProject };
