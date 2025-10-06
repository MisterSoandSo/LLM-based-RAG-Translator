document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chatBox");
  const userInput = document.getElementById("userInput");
  const toggleHighlight = document.getElementById("toggleHighlight");

  // -------------------------
  // Create popup menu early
  // -------------------------
  const popupMenu = document.createElement("div");
  popupMenu.id = "popupMenu";
  popupMenu.style.position = "absolute";
  popupMenu.style.display = "none";
  popupMenu.style.zIndex = 9999;
  popupMenu.style.background = "#fff";
  popupMenu.style.border = "1px solid #ccc";
  popupMenu.style.borderRadius = "4px";
  popupMenu.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  document.body.appendChild(popupMenu);

  const glossaryBtn = document.createElement("button");
  glossaryBtn.textContent = "➕ Glossary";
  glossaryBtn.style.display = "block";
  glossaryBtn.style.width = "100%";

  const grammarBtn = document.createElement("button");
  grammarBtn.textContent = "✏️ Grammar Check";
  grammarBtn.style.display = "block";
  grammarBtn.style.width = "100%";

  popupMenu.appendChild(glossaryBtn);
  popupMenu.appendChild(grammarBtn);

  // -------------------------
  // Highlight toggle
  // -------------------------
  let highlightEnabled = toggleHighlight ? toggleHighlight.checked : true;
  if (toggleHighlight) {
    toggleHighlight.addEventListener("change", (e) => {
      highlightEnabled = e.target.checked;
    });
  }

  // -------------------------
  // Show popup menu on text selection
  // -------------------------
  document.addEventListener("mouseup", (e) => {
    if (!highlightEnabled) return;
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
      popupMenu.style.left = e.pageX + "px";
      popupMenu.style.top = e.pageY + "px";
      popupMenu.style.display = "block";
    } else {
      popupMenu.style.display = "none";
    }
  });

  // -------------------------
  // Glossary highlighting helpers
  // -------------------------
  let currentGlossary = {};

  function parseGlossaryPrompt(glossaryText) {
    const dict = {};
    const lines = glossaryText.split("\n");
    for (const line of lines) {
      const match = line.match(/^(.+?)\s*→\s*(.+)$/);
      if (match) {
        dict[match[1].trim()] = match[2].trim();
      }
    }
    return dict;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightGlossaryTerms(text, glossaryDict) {
    let result = text;
    for (const [src, tgt] of Object.entries(glossaryDict)) {
      const regex = new RegExp(`(${escapeRegex(src)}|${escapeRegex(tgt)})`, "g");
      result = result.replace(regex, `<span class="highlight-term">$1</span>`);
    }
    return result;
  }

  // -------------------------
  // Add message to chat
  // -------------------------
 function addMessage(text, type = "assistant") {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${type}`;

  // Debug / glossary messages: preserve newlines
  if (type === "assistant" && (text.startsWith("GLOSSARY") || text.startsWith("DEBUG PROMPT"))) {
    msgDiv.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; margin:0;">${text}</pre>`;
  } 
  // Normal assistant messages: highlight glossary
  else if (type === "assistant") {
    msgDiv.innerHTML = highlightGlossaryTerms(text, currentGlossary);
  } 
  else {
    msgDiv.textContent = text;
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

  // -------------------------
  // Send message (translation)
  // -------------------------
  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    userInput.value = "";
    addMessage(message, "user");

    try {
      const response = await fetch("/chat/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();

      // Update glossary
      if (data.glossary_prompt) {
        currentGlossary = parseGlossaryPrompt(data.glossary_prompt);
        addMessage("GLOSSARY\n" + data.glossary_prompt, "assistant");
      }

      // Show debug system prompt if present
      if (data.system_prompt) {
        addMessage("DEBUG PROMPT:\n" + data.system_prompt, "assistant");
      }

      // Add translated reply
      if (data.reply) addMessage(data.reply, "assistant");
    } catch (err) {
      console.error(err);
      addMessage("❌ Error connecting to server", "assistant");
    }
  }

  window.sendMessage = sendMessage;

  // -------------------------
  // Grammar check button
  // -------------------------
  grammarBtn.addEventListener("click", async () => {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;
    popupMenu.style.display = "none";

    try {
      const response = await fetch("/chat/grammarly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: selection }),
      });
      const data = await response.json();
      addMessage("Original: " + selection, "user");
      addMessage("Corrected: " + data.reply, "assistant");
    } catch (err) {
      console.error(err);
      addMessage("❌ Error checking grammar", "assistant");
    }
  });

  // -------------------------
  // Glossary add button
  // -------------------------
  glossaryBtn.addEventListener("click", () => {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;
    document.getElementById("term").value = selection;
    popupMenu.style.display = "none";
    window.getSelection().removeAllRanges();
  });
});
