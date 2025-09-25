
    // --- Chat functionality ---
    async function sendMessage() {
      const input = document.getElementById("userInput");
      const message = input.value.trim();
      if (!message) return;
      input.value = "";

      const chatBox = document.getElementById("chatBox");

      // User message
      const userDiv = document.createElement("div");
      userDiv.className = "message user";
      userDiv.textContent = message;
      chatBox.appendChild(userDiv);
      chatBox.scrollTop = chatBox.scrollHeight;

      // Send to backend
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await response.json();

      // Assistant reply
if (data.glossary_prompt) {
  const glossaryDiv = document.createElement("div");
  glossaryDiv.className = "message assistant";

  // Preserve newlines, but still wrap long lines
  glossaryDiv.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; margin:0;">${data.glossary_prompt}</pre>`;

  chatBox.appendChild(glossaryDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

if (data.reply) {
  const botDiv = document.createElement("div");
  botDiv.className = "message assistant";
  botDiv.textContent = data.reply;
  chatBox.appendChild(botDiv);
}

chatBox.scrollTop = chatBox.scrollHeight;
    }

    // --- Glossary functionality ---
    document.addEventListener("DOMContentLoaded", () => {
      const glossaryForm = document.getElementById("glossaryForm");
      const glossaryList = document.querySelector("#addedGlossary ul");
      const glossaryStatus = document.getElementById("glossaryStatus");
      const toggleHighlight = document.getElementById("toggleHighlight");

      let highlightEnabled = toggleHighlight.checked;

      // Toggle highlight functionality
      toggleHighlight.addEventListener("change", (e) => {
        highlightEnabled = e.target.checked;
        glossaryBtn.style.display = "none";
      });

      // Create a single glossary button
      const glossaryBtn = document.createElement("button");
      glossaryBtn.id = "glossaryBtn";
      glossaryBtn.textContent = "➕ Glossary";
      glossaryBtn.style.position = "absolute";
      glossaryBtn.style.display = "none";
      glossaryBtn.style.zIndex = 9999;
      document.body.appendChild(glossaryBtn);

      glossaryBtn.addEventListener("click", () => {
        const selection = window.getSelection().toString().trim();
        if (!selection) return;

        document.getElementById("term").value = selection;
        glossaryBtn.style.display = "none";
        window.getSelection().removeAllRanges();
      });

      // Highlight listener
      document.addEventListener("mouseup", (e) => {
        if (!highlightEnabled) return;

        const selection = window.getSelection().toString().trim();
        if (selection.length > 0) {
          glossaryBtn.style.left = e.pageX + "px";
          glossaryBtn.style.top = e.pageY + "px";
          glossaryBtn.style.display = "block";
        } else {
          glossaryBtn.style.display = "none";
        }
      });

      // Glossary form submit
      glossaryForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const term = document.getElementById("term").value.trim();
        const definition = document.getElementById("definition").value.trim();
        if (!term || !definition) return;

        const formData = new FormData();
        formData.append("term", term);
        formData.append("definition", definition);

        try {
          const response = await fetch("/add_glossary_term", { method: "POST", body: formData });
          const result = await response.json();
          if (result.status === "success") {
            glossaryStatus.innerText = `✅ Added "${result.term}" → ${result.definition}`;

            const li = document.createElement("li");
            li.textContent = `${result.term} → ${result.definition}`;
            glossaryList.appendChild(li);

            document.getElementById("term").value = "";
            document.getElementById("definition").value = "";
          } else {
            glossaryStatus.innerText = "❌ Failed to save term.";
          }
        } catch (err) {
          console.error(err);
          glossaryStatus.innerText = "❌ Error saving term.";
        }
      });
    });
