const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const maxCanvasWidth = 1200; // キャンバスの最大幅
let images = []; // 画像のリスト
let isDragging = false; // ドラッグ中かどうか
let startY = 0; // ドラッグ開始時のY座標
let draggedImageIndex = null; // ドラッグ中の画像のインデックス
let isTrimming = false; // トリミング中かどうか
let trimmingHandle = null; // トリミング用ハンドルの位置

// 最初のキャンバスサイズ
canvas.width = maxCanvasWidth;
canvas.height = 800;

// 画像オブジェクトの定義
class CanvasImage {
  constructor(img, x, y, width, height, opacity = 1) {
    this.img = img;
    this.x = x; // 描画位置x
    this.y = y; // 描画位置y
    this.width = width; // 描画後の横幅
    this.height = height; // 描画後の縦幅
    this.opacity = opacity;
    this._trimTop = 0; // 上部トリミング
    this.trimBottom = 0; // 下部トリミング
    this.isFixed = false;
  }

  get trimTop() {
    return this._trimTop;
  }
  /**
   * @param {number} num
   */
  set trimTop(num) {
    if (num < 0) {
      this._trimTop = 0;
    } else if (num > this.height - 100) {
      this._trimTop = this.height - 100;
    } else {
      this._trimTop = num;
    }
  }

  draw() {
    ctx.globalAlpha = this.opacity;
    const visibleHeight = this.height - this._trimTop - this.trimBottom;
    const scaleFactor = this.img.width / this.width;
    const sourceTrimTop = this._trimTop * scaleFactor;
    const sourceVisibleHeight =
      (this.height - this._trimTop - this.trimBottom) * scaleFactor;
    ctx.drawImage(
      this.img,
      0,
      sourceTrimTop,
      this.img.width,
      sourceVisibleHeight,
      this.x,
      this.y,
      this.width,
      visibleHeight
    );
    ctx.globalAlpha = 1;

    if (!this.isFixed) {
      this.drawHandles();
    }
  }

  drawHandles() {
    const handleText = "✄";
    const fontSize = 40;

    ctx.fillStyle = "red";
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;

    ctx.fill();
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "red";
    ctx.fillText(handleText, this.x + this.width / 2, this.y);
    ctx.fillText(
      handleText,
      this.x + this.width / 2,
      this.y + this.height - this._trimTop - this.trimBottom
    );

    const lineDash = [5, 5];
    ctx.setLineDash(lineDash);

    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.height - this._trimTop - this.trimBottom);
    ctx.lineTo(
      this.x + this.width,
      this.y + this.height - this._trimTop - this.trimBottom
    );
    ctx.stroke();

    ctx.setLineDash([]);
  }

  contains(x, y) {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }

  isOnTopHandle(x, y) {
    return Math.abs(y - this.y) < 20;
  }

  isOnBottomHandle(x, y) {
    return (
      Math.abs(y - (this.y + this.height - this._trimTop - this.trimBottom)) <
      20
    );
  }
}

// ドラッグ&ドロップで画像追加
canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
});

canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let newY = 0;
          let opacity = 1;
          let scaledWidth = img.width;
          let scaledHeight = img.height;
          // 画像がキャンバスの最大幅を超える場合縦横比そのまま縮小して反映
          if (img.width > maxCanvasWidth) {
            const scaleFactor = maxCanvasWidth / img.width;
            scaledWidth = maxCanvasWidth;
            scaledHeight = img.height * scaleFactor;
          }
          // 最初の画像はキャンバスをその画像の高さに合わせて拡張
          if (images.length === 0) {
            canvas.height = scaledHeight;
          } else {
            // 前の画像の真下に配置、透明度50%
            const lastImage = images[images.length - 1];
            newY =
              lastImage.y +
              lastImage.height -
              lastImage.trimTop -
              lastImage.trimBottom;
            if (newY + scaledHeight > canvas.height) {
              canvas.height = newY + scaledHeight;
            }
          }
          const canvasImage = new CanvasImage(
            img,
            0,
            newY,
            scaledWidth,
            scaledHeight,
            0.5
          );
          images.push(canvasImage);
          drawImages();
        };
      };
      reader.readAsDataURL(file);
    });
  }
});

const imageInfo = document.getElementById("image-info");

function drawImages() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  while (imageInfo.firstChild) {
    imageInfo.removeChild(imageInfo.firstChild);
  }
  images.forEach((image, index) => {
    if (index != 0 && index == images.length - 1 && !images[index].isFixed) {
      image.isFixed = false;
    } else {
      image.isFixed = true;
      image.opacity = 1;
    }
    image.draw();
    addImageInfoRow(index);
  });
	toggleDownloadButton()
}

function resizeCanvasToFitContent() {
  const bottomHeights = images.map((img) => {
    return img.y + img.height - img.trimTop - img.trimBottom;
  });
  const maxHeights = bottomHeights.reduce((a, b) => {
    return Math.max(a, b);
  });
  canvas.height = maxHeights;
}

class DownloadButton extends HTMLButtonElement {
  constructor() {
    super();
    this.disabled = true;
    this.appendChild(document.createTextNode("画像をダウンロード"));
    this.addEventListener("click", () => {
      const dataURL = canvas.toDataURL("image/png");
      const newTab = window.open();
      if (newTab) {
        newTab.document.write('<img src="' + dataURL + '">');
        newTab.document.close();
      } else {
        alert(
          "ポップアップがブロックされました。ポップアップを許可してください。"
        );
      }
    });
  }
}
customElements.define("download-button", DownloadButton, { extends: "button" });

function toggleDownloadButton() {
  const downloadArea = document.getElementById("wrapp-download");
	while (downloadArea.firstChild) {
    downloadArea.removeChild(downloadArea.firstChild);
  }
  const downloadButton = document.createElement("button", {
    is: "download-button",
  });
	downloadButton.disabled = false;
  images.forEach((image) => {
    if (!image.isFixed) {
			downloadButton.disabled = true;
    }
  });
	downloadArea.appendChild(downloadButton);
}

class FixButton extends HTMLButtonElement {
  constructor() {
    super();
    this.disabled = false;
    this.imageIndex;
    this.type = "button";
    this.appendChild(document.createTextNode("画像を固定"));
    this.addEventListener("click", () => {
      images[this.imageIndex].isFixed = true;
      resizeCanvasToFitContent();
      drawImages();
    });
  }
}
customElements.define("fix-button", FixButton, { extends: "button" });

class UnfixButton extends HTMLButtonElement {
  constructor() {
    super();
    this.disabled = false;
    this.imageIndex;
    this.type = "button";
    this.appendChild(document.createTextNode("固定を解除"));
    this.addEventListener("click", () => {
      images[this.imageIndex].isFixed = false;
      drawImages();
    });
  }
}
customElements.define("unfix-button", UnfixButton, { extends: "button" });

class RemoveButton extends HTMLButtonElement {
  constructor() {
    super();
    this.imageIndex;
    this.type = "button";
    this.appendChild(document.createTextNode("画像を削除"));
    this.addEventListener("click", () => {
      images.splice(this.imageIndex, 1);
      if (images.length) {
        images[images.length - 1].isFixed = false;
      }
      drawImages();
    });
  }
}
customElements.define("remove-button", RemoveButton, { extends: "button" });

function addImageInfoRow(imageIndex) {
  const fixButton = document.createElement("button", { is: "fix-button" });
  //const unfixButton = document.createElement("button", { is: "unfix-button" });
  const removeButton = document.createElement("button", {
    is: "remove-button",
  });

  fixButton.imageIndex = imageIndex;
  //unfixButton.imageIndex = imageIndex;
  removeButton.imageIndex = imageIndex;

  if (images[imageIndex].isFixed) {
    fixButton.disabled = true;
  } else {
    //unfixButton.disabled = true;
  }

  const tr = document.createElement("tr");
  const image = document.createElement("td");
  const fix = document.createElement("td");
  //const unfix = document.createElement("td");
  const remove = document.createElement("td");

  image.appendChild(document.createTextNode(imageIndex + 1 + "枚目: "));
  fix.appendChild(fixButton);
  //unfix.appendChild(unfixButton);
  remove.appendChild(removeButton);

  tr.appendChild(image);
  tr.appendChild(fix);
  //tr.appendChild(unfix);
  tr.appendChild(remove);
  imageInfo.appendChild(tr);
}

// ドラッグ/トリミング開始
canvas.addEventListener("mousedown", (e) => {
  const mouseX = e.clientX - canvas.getBoundingClientRect().left;
  const mouseY = e.clientY - canvas.getBoundingClientRect().top;

  // クリックされた画像を検出, 固定してる場合は終了
  for (let i = images.length - 1; i >= 0; i--) {
    if (images[i].isFixed) {
      break;
    }
    if (images[i].isOnTopHandle(mouseX, mouseY)) {
      isTrimming = true;
      trimmingHandle = "top";
      draggedImageIndex = i;
      startY = mouseY;
      break;
    } else if (images[i].isOnBottomHandle(mouseX, mouseY)) {
      isTrimming = true;
      trimmingHandle = "bottom";
      draggedImageIndex = i;
      startY = mouseY;
      break;
    } else if (images[i].contains(mouseX, mouseY)) {
      draggedImageIndex = i;
      startY = mouseY;
      isDragging = true;
      break;
    }
  }
});

// ドラッグ/トリミング処理
canvas.addEventListener("mousemove", (e) => {
  if (isDragging && draggedImageIndex !== null) {
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    const deltaY = mouseY - startY;

    images[draggedImageIndex].y += deltaY;
    startY = mouseY;
    if (
      images[draggedImageIndex].y + images[draggedImageIndex].height >
      canvas.height
    ) {
      canvas.height =
        images[draggedImageIndex].y + images[draggedImageIndex].height;
    }
    drawImages();
  } else if (isTrimming && draggedImageIndex !== null) {
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;
    const deltaY = mouseY - startY;

    if (trimmingHandle === "top") {
      images[draggedImageIndex].trimTop =
        images[draggedImageIndex].trimTop + deltaY;
    } else if (trimmingHandle === "bottom") {
      images[draggedImageIndex].trimBottom = Math.max(
        0,
        images[draggedImageIndex].trimBottom - deltaY
      );
    }
    startY = mouseY;
    drawImages();
  }
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  draggedImageIndex = null;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  draggedImageIndex = null;
});
