const text = "Elysia";
const target = document.getElementById("animatedText");
let i = 0;

function typeWriter() {
  if (i < text.length) {
    target.textContent += text.charAt(i);
    i++;
    setTimeout(typeWriter, 300);
  }
}

window.onload = typeWriter;