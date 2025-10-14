document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chatBox");
  const userInput = document.getElementById("userInput");
  const toggleHighlight = document.getElementById("toggleHighlight");

  // -------------------------
  // Popup menu setup
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
  glossaryBtn.textContent = "Glossary";
  glossaryBtn.style.display = "block";
  glossaryBtn.style.width = "100%";

  const grammarBtn = document.createElement("button");
  grammarBtn.textContent = "Grammar Check";
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
  // Popup show on selection
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
  // Glossary utilities
  // -------------------------
  function parseGlossaryPrompt(glossaryText) {
    const dict = {};
    const lines = glossaryText.split("\n");
    for (const line of lines) {
      const match = line.match(/^(.+?)\s*→\s*(.+)$/);
      if (match) dict[match[1].trim()] = match[2].trim();
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
  // Message helpers
  // -------------------------
  function addMessage(text, type = "assistant") {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${type}`;

    if (type === "assistant" && (text.startsWith("GLOSSARY") || text.startsWith("DEBUG PROMPT"))) {
      msgDiv.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; margin:0;">${text}</pre>`;
    } else if (type === "assistant") {
      msgDiv.innerHTML = highlightGlossaryTerms(text, currentGlossary);
    } else {
      msgDiv.textContent = text;
    }

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // -------------------------
  // Chat logic
  // -------------------------
  let chatStage = "start";
  let pendingGlossary = {};
  let lastUserMessage = "";
  let currentGlossary = {};

  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message && chatStage === "start") return;
    if (chatStage === "start") lastUserMessage = message;
    if (chatStage === "start") addMessage(message, "user");

    const endpoint = chatStage === "start"
      ? "/chat/translate/start"
      : "/chat/translate/confirm";

    const body = chatStage === "start"
      ? { message: lastUserMessage }
      : { message: lastUserMessage, confirmed_glossary: pendingGlossary };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (data.stage === "confirm_glossary") {
        displayGlossaryConfirmation(data.glossary_options);
        chatStage = "confirm";
      } else if (data.stage === "complete") {
        if (data.glossary_prompt) {
          currentGlossary = parseGlossaryPrompt(data.glossary_prompt);
          addMessage("GLOSSARY\n" + data.glossary_prompt, "assistant");
        }
        if (data.reply) addMessage(data.reply, "assistant");
        chatStage = "start";
      }
    } catch (err) {
      console.error(err);
      addMessage("❌ Error connecting to server", "assistant");
    }
  }

  window.sendMessage = sendMessage;

  // -------------------------
  // Glossary confirmation
  // -------------------------
  function displayGlossaryConfirmation(glossaryOptions) {
    const container = document.createElement("div");
    container.className = "glossary-confirmation";

    const title = document.createElement("h4");
    title.textContent = "Please confirm glossary definitions:";
    container.appendChild(title);

    for (const [term, definition] of Object.entries(glossaryOptions)) {
      const block = document.createElement("div");
      block.className = "glossary-choice-block";

      const label = document.createElement("div");
      label.innerHTML = `<b>${term}</b>`;
      block.appendChild(label);

      const select = document.createElement("select");
      const opt = document.createElement("option");
      opt.value = definition;
      opt.textContent = definition;
      select.appendChild(opt);
      select.addEventListener("change", () => {
        pendingGlossary[term] = select.value;
      });
      pendingGlossary[term] = definition;
      block.appendChild(select);
      container.appendChild(block);
    }

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm and Translate";
    confirmBtn.onclick = () => {
      addMessage("Confirmed glossary terms. Translating...", "assistant");
      chatBox.removeChild(container);
      sendMessage();
    };
    container.appendChild(confirmBtn);

    chatBox.appendChild(container);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // -------------------------
  // Grammar check button (fixed)
  // -------------------------
  grammarBtn.addEventListener("click", async () => {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;
    popupMenu.style.display = "none";

    try {
      const response = await fetch("/chat/translate/polish", { 
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
    const termInput = document.getElementById("term");
    if (termInput) termInput.value = selection;
    popupMenu.style.display = "none";
    window.getSelection().removeAllRanges();
  });
});
