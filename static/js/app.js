const pdfInput = document.getElementById("pdfInput");
const originalSizeDisplay = document.getElementById("originalSizeDisplay");
const previewContainer = document.getElementById("previewContainer");
const processBtn = document.getElementById("processBtn");
const resultContainer = document.getElementById("resultContainer");
const methodOptions = document.getElementById("methodOptions");
const methodRadios = document.getElementsByName("compressionMethod");
const imageOptions = document.getElementById("imageOptions");
const scaleSlider = document.getElementById("scaleSlider");
const scaleValue = document.getElementById("scaleValue");
const jpegQuality = document.getElementById("jpegQuality");
const jpegQualityValue = document.getElementById("jpegQualityValue");
const zoomOverlay = document.getElementById("zoomOverlay");
const zoomImage = document.getElementById("zoomImage");

let loadedPDF = null, originalPdfBytes = null, originalFileSize = 0;
let zoomScale = 1, panX = 0, panY = 0;
let isDragging = false, startX = 0, startY = 0;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// Atualiza sliders e preview (se método imagem ativo)
scaleSlider.addEventListener("input", () => {
  scaleValue.textContent = parseFloat(scaleSlider.value).toFixed(2);
  if (currentMethod() === 'imagem') updatePreviewImage();
});

jpegQuality.addEventListener("input", () => {
  jpegQualityValue.textContent = jpegQuality.value + "%";
  if (currentMethod() === 'imagem') updatePreviewImage();
});

function currentMethod() {
  for (const radio of methodRadios) {
    if (radio.checked) return radio.value;
  }
  return null;
}

// Exibe opções específicas se "Por Imagem" for escolhido
for (const radio of methodRadios) {
  radio.addEventListener("change", () => {
    if (currentMethod() === 'imagem') {
      imageOptions.style.display = "block";
      updatePreviewImage();
    } else {
      imageOptions.style.display = "none";
      updatePreviewDefault();
    }
  });
}

function attachZoomListener(img) {
  img.addEventListener("click", () => openZoomOverlay(img.src));
}

async function updatePreviewImage() {
  if (!loadedPDF) return;
  try {
    const page = await loadedPDF.getPage(1);
    const viewport = page.getViewport({ scale: parseFloat(scaleSlider.value) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const imgData = canvas.toDataURL("image/jpeg", jpegQuality.value / 100);
    const img = new Image();
    img.src = imgData;
    previewContainer.innerHTML = "";
    previewContainer.appendChild(img);
    attachZoomListener(img);
  } catch (e) {
    console.error(e);
  }
}

async function updatePreviewDefault() {
  if (!loadedPDF) return;
  try {
    const page = await loadedPDF.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const imgData = canvas.toDataURL("image/jpeg", 1);
    const img = new Image();
    img.src = imgData;
    previewContainer.innerHTML = "";
    previewContainer.appendChild(img);
    attachZoomListener(img);
  } catch (e) {
    console.error(e);
  }
}

pdfInput.addEventListener("change", async () => {
  const file = pdfInput.files[0];
  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    alert("Selecione um PDF válido.");
    return;
  }
  originalFileSize = file.size;
  originalSizeDisplay.innerHTML = `<strong>😵‍💫 Tamanho inicial: ${formatBytes(originalFileSize)}</strong>`;
  originalPdfBytes = await file.arrayBuffer();
  loadedPDF = await pdfjsLib.getDocument({ data: originalPdfBytes }).promise;
  methodOptions.style.display = "block";
  updatePreviewDefault();
});

async function compressViaImage() {
  const { jsPDF } = window.jspdf;
  let novoPDF = null;
  for (let i = 1; i <= loadedPDF.numPages; i++) {
    const page = await loadedPDF.getPage(i);
    const viewport = page.getViewport({ scale: parseFloat(scaleSlider.value) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const imgData = canvas.toDataURL("image/jpeg", jpegQuality.value / 100);
    if (i === 1) {
      novoPDF = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
    } else {
      novoPDF.addPage([canvas.width, canvas.height], "portrait");
    }
    novoPDF.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
  }
  return novoPDF.output("blob");
}

async function compressViaPdfLib() {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
  pages.forEach(p => newPdf.addPage(p));
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

async function processCompression() {
  if (!loadedPDF || !originalPdfBytes) {
    alert("Selecione um PDF primeiro.");
    return;
  }
  const method = currentMethod();
  if (!method) {
    alert("Escolha um método de compressão.");
    return;
  }
  resultContainer.innerHTML = `
    <div class="d-flex flex-column align-items-center">
      <div class="spinner-border pink mb-2" role="status"></div>
      <p>Analisando compressão...</p>
    </div>`;
  let blob;
  try {
    if (method === 'imagem') {
      blob = await compressViaImage();
    } else if (method === 'rebuild') {
      blob = await compressViaPdfLib();
    }
  } catch (e) {
    console.error(e);
    resultContainer.innerHTML = "<p style='color:#ff4081;'>Erro durante a compressão.</p>";
    return;
  }
  resultContainer.innerHTML = `
    <p style="color:#ff4081;"><strong>Tamanho final: ${formatBytes(blob.size)}</strong></p>
    <div class="text-center">
      <a href="${URL.createObjectURL(blob)}" download="compressed.pdf" class="btn btn-custom">
        Baixar PDF
      </a>
    </div>`;
}

processBtn.addEventListener("click", processCompression);

// Funções de Zoom e Pan
function updateZoomTransform() {
  zoomImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}

function openZoomOverlay(src) {
  zoomImage.src = src;
  zoomScale = 1;
  panX = 0;
  panY = 0;
  updateZoomTransform();
  zoomOverlay.style.display = "flex";
}

zoomOverlay.addEventListener("click", (e) => {
  if (e.target === zoomOverlay || e.target === zoomImage) {
    zoomOverlay.style.display = "none";
  }
});

zoomOverlay.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY < 0) {
    zoomScale += 0.1;
  } else {
    zoomScale = Math.max(0.5, zoomScale - 0.1);
  }
  updateZoomTransform();
});

zoomImage.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
  zoomImage.style.cursor = "grabbing";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateZoomTransform();
  }
});

document.addEventListener("mouseup", () => {
  isDragging = false;
  zoomImage.style.cursor = "grab";
});

zoomImage.addEventListener("touchstart", (e) => {
  isDragging = true;
  let touch = e.touches[0];
  startX = touch.clientX - panX;
  startY = touch.clientY - panY;
});

zoomImage.addEventListener("touchmove", (e) => {
  if (isDragging) {
    let touch = e.touches[0];
    panX = touch.clientX - startX;
    panY = touch.clientY - startY;
    updateZoomTransform();
  }
});

zoomImage.addEventListener("touchend", () => {
  isDragging = false;
});
