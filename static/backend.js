// project.js
document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chatBox");
  const userInput = document.getElementById("userInput");
  const toggleHighlight = document.getElementById("toggleHighlight");

  // -------------------------
  // Popup menu setup
  // -------------------------
  const popupMenu = document.createElement("div");
  popupMenu.id = "popupMenu";
  Object.assign(popupMenu.style, {
    position: "absolute",
    display: "none",
    zIndex: 9999,
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    padding: "6px"
  });
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
    if (!glossaryText) return dict;
    const lines = glossaryText.split("\n").map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      // supports "term → definition" or "term: definition"
      const matchArrow = line.match(/^(.+?)\s*→\s*(.+)$/);
      const matchColon = line.match(/^(.+?)\s*:\s*(.+)$/);
      if (matchArrow) dict[matchArrow[1].trim()] = matchArrow[2].trim();
      else if (matchColon) dict[matchColon[1].trim()] = matchColon[2].trim();
    }
    return dict;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightGlossaryTerms(text, glossaryDict) {
    if (!glossaryDict || Object.keys(glossaryDict).length === 0) return text;
    // Sort keys by length desc to avoid partial matches shadowing longer ones
    const terms = Object.keys(glossaryDict).sort((a, b) => b.length - a.length);
    if (terms.length === 0) return text;
    const pattern = terms.map(t => escapeRegex(t)).join("|");
    const regex = new RegExp(`(${pattern}|${terms.map(t => escapeRegex(glossaryDict[t])).join("|")})`, "g");
    return text.replace(regex, '<span class="highlight-term">$1</span>');
  }

  // -------------------------
  // Message helpers
  // -------------------------
  // type: "assistant" | "assistant-card" | "user" | "system"
  function addMessage(text, type = "assistant", glossary = {}) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${type}`;

    if (type === "assistant-card") {
      // render as a subtle info card (icon + content)
      msgDiv.innerHTML = `
        <div class="assist-card" style="display:flex;align-items:center;gap:10px;
              padding:10px;border-radius:8px;background:#f8f9fb;border:1px solid #e1e6ef;">
          <div class="assist-card-icon" style="flex:0 0 36px; height:36px; width:36px; border-radius:6px;
               display:flex;align-items:center;justify-content:center;background:#e6eefc;color:#1b59c6;font-weight:700;">
            i
          </div>
          <div class="assist-card-body" style="font-size:13px;line-height:1.3;">${text}</div>
        </div>
      `;
    } else if (type === "assistant" && (typeof text === "string") && (text.startsWith("GLOSSARY") || text.startsWith("DEBUG PROMPT"))) {
      // show raw preformatted for debug/glossary prompts
      msgDiv.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; margin:0;">${text}</pre>`;
    } else if (type === "assistant") {
      // highlight glossary on plain assistant messages using provided glossary
      msgDiv.innerHTML = highlightGlossaryTerms(text, glossary);
    } else if (type === "user") {
      msgDiv.textContent = text;
    } else {
      // system or other raw HTML (if we want to allow HTML)
      msgDiv.innerHTML = text;
    }

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
  }

  // -------------------------
  // Chat logic
  // -------------------------
  let chatStage = "start";
  let pendingGlossary = {};           // what user confirmed to send to server
  let lastUserMessage = "";
  let lastSystemGlossary = {};        // original glossary suggested by system (for comparison)

  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message && chatStage === "start") return;
    if (chatStage === "start") {
      lastUserMessage = message;
      addMessage(message, "user");
    }

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
        // system provided glossary options to review/confirm
        const options = data.glossary_options || {};
        lastSystemGlossary = options;
        displayGlossaryConfirmation(options);
        chatStage = "confirm";
      } else if (data.stage === "complete") {
        // TEMPORARY glossary only for this reply
        let tempGlossary = {};
        if (data.glossary_prompt) {
          tempGlossary = parseGlossaryPrompt(data.glossary_prompt);
          // keep the raw prompt visible for debugging or user reference
          addMessage("GLOSSARY\n" + data.glossary_prompt, "assistant");
        }

        if (data.reply) {
          // show assistant reply highlighted only with tempGlossary
          addMessage(data.reply, "assistant", tempGlossary);
        }

        // clear pending glossary and stage for next round
        pendingGlossary = {};
        lastSystemGlossary = {};
        chatStage = "start";
        // optionally clear the input
        if (chatStage === "start") userInput.value = "";
      } else {
        // fallback: if server returns other shape, just print it
        if (data.reply) addMessage(data.reply, "assistant");
      }
    } catch (err) {
      console.error(err);
      addMessage("❌ Error connecting to server", "assistant");
    }
  }

  window.sendMessage = sendMessage;

  // -------------------------
  // Glossary confirmation (editable + removable + detect changes)
  // -------------------------
  function displayGlossaryConfirmation(glossaryOptions) {
    const container = document.createElement("div");
    container.className = "glossary-confirmation";
    Object.assign(container.style, { margin: "8px 0" });

    const title = document.createElement("h4");
    title.textContent = "Please confirm, edit, or remove glossary definitions:";
    title.style.margin = "0 0 8px 0";
    container.appendChild(title);

    // store original system suggestions for comparison
    const original = Object.assign({}, glossaryOptions);
    lastSystemGlossary = original;

    // reset pendingGlossary
    pendingGlossary = {};

    // Each row: term label, editable input (or textarea), remove checkbox
    for (const [term, definition] of Object.entries(original)) {
      const block = document.createElement("div");
      block.className = "glossary-choice-block";
      Object.assign(block.style, {
        marginBottom: "8px",
        padding: "8px 10px",
        border: "1px solid #e0e6ef",
        borderRadius: "6px",
        background: "#fbfdff",
        display: "flex",
        gap: "8px",
        alignItems: "center"
      });

      const termLabel = document.createElement("div");
      termLabel.innerHTML = `<b>${escapeHtml(term)}</b>`;
      termLabel.style.minWidth = "120px";
      block.appendChild(termLabel);

      const input = document.createElement("input");
      input.type = "text";
      input.value = definition;
      input.style.flex = "1";
      input.style.padding = "6px";
      input.style.border = "1px solid #cfd8e6";
      input.style.borderRadius = "4px";
      block.appendChild(input);

      // Remove checkbox
      const removeLabel = document.createElement("label");
      removeLabel.style.display = "flex";
      removeLabel.style.alignItems = "center";
      removeLabel.style.gap = "6px";
      const removeCheckbox = document.createElement("input");
      removeCheckbox.type = "checkbox";
      removeCheckbox.title = "Remove this term from the glossary to be sent";
      removeLabel.appendChild(removeCheckbox);
      removeLabel.appendChild(document.createTextNode("Remove"));
      block.appendChild(removeLabel);

      // Initialize pendingGlossary with default
      pendingGlossary[term] = definition;

      // handlers
      input.addEventListener("input", () => {
        if (!removeCheckbox.checked) {
          pendingGlossary[term] = input.value.trim();
        }
      });

      removeCheckbox.addEventListener("change", () => {
        if (removeCheckbox.checked) {
          delete pendingGlossary[term];
          input.disabled = true;
          block.style.opacity = "0.55";
        } else {
          pendingGlossary[term] = input.value.trim();
          input.disabled = false;
          block.style.opacity = "1";
        }
      });

      container.appendChild(block);
    }

    const actions = document.createElement("div");
    actions.style.marginTop = "10px";
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm and Translate";
    confirmBtn.style.padding = "8px 12px";
    confirmBtn.onclick = () => {
      // Validate: no empty definitions
      for (const [term, def] of Object.entries(pendingGlossary)) {
        if (!def || !def.trim()) {
          alert(`Definition for "${term}" cannot be empty.`);
          return;
        }
      }

      // detect changed terms (definition changed vs original)
      const changedTerms = [];
      for (const term of Object.keys(original)) {
        // if user removed it, it's not "changed" for the purpose of generating manage links
        if (!(term in pendingGlossary)) continue;
        if (original[term] !== pendingGlossary[term]) changedTerms.push(term);
      }

      // Post messages for changed terms (assistant-card)
      for (const term of changedTerms) {
        const encoded = encodeURIComponent(term);
        const linkHref = `/glossary/?sort_by=alpha&sort_dir=asc&q=${encoded}`;
        const cardHtml = `
          You updated: <b>${escapeHtml(term)}</b><br/>
          <a href="${linkHref}" target="_blank" rel="noopener noreferrer">Manage this term</a>
        `;
        addMessage(cardHtml, "assistant-card");
      }

      addMessage("Confirmed and edited glossary terms. Translating...", "assistant");
      // remove UI
      if (container.parentElement === chatBox) chatBox.removeChild(container);
      // set stage and call sendMessage (this will use pendingGlossary)
      chatStage = "confirm";
      // proceed to send confirm call
      sendMessage();
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.padding = "8px 12px";
    cancelBtn.onclick = () => {
      if (container.parentElement === chatBox) chatBox.removeChild(container);
      pendingGlossary = {};
      chatStage = "start";
      addMessage("Cancelled glossary confirmation.", "assistant");
    };

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    container.appendChild(actions);

    chatBox.appendChild(container);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // -------------------------
  // Grammar check button
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
      addMessage("Corrected: " + (data.reply || "—"), "assistant");
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

  // -------------------------
  // Utility: safe escape html for display in innerHTML
  // -------------------------
  function escapeHtml(unsafe) {
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // expose small helpers for debugging
  window._project = {
    sendMessage,
    addMessage,
    parseGlossaryPrompt
  };
});

