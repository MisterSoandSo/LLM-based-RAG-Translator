// Utility to escape user input safely
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

document.querySelectorAll("#glossaryTable .editBtn").forEach(btn => {
    btn.addEventListener("click", e => {
        const row = e.target.closest("tr");

        // Prevent multiple inline edits
        if (document.querySelector(".inline-edit-row")) return;

        const id = row.dataset.id;
        const chinese = row.dataset.chinese;
        const english = row.dataset.english;
        const notes = row.dataset.notes;

        // Replace row with editable inputs
        const editRow = document.createElement("tr");
        editRow.classList.add("inline-edit-row");
        editRow.innerHTML = `
            <td><input type="text" name="chinese" value="${escapeHtml(chinese)}" required></td>
            <td><input type="text" name="english" value="${escapeHtml(english)}" required></td>
            <td><input type="text" name="notes" value="${escapeHtml(notes)}"></td>
            <td>
                <button type="button" class="saveBtn">Save</button>
                <button type="button" class="cancelBtn">Cancel</button>
            </td>
        `;

        row.style.display = "none";
        row.parentNode.insertBefore(editRow, row.nextSibling);

        // Save button
        editRow.querySelector(".saveBtn").addEventListener("click", () => {
            const formData = new FormData();
            formData.append("chinese", editRow.querySelector("[name='chinese']").value);
            formData.append("english", editRow.querySelector("[name='english']").value);
            formData.append("notes", editRow.querySelector("[name='notes']").value);

            fetch(`/glossary/${id}`, {
                method: "PATCH",
                body: formData
            })
            .then(res => {
                if (!res.ok) throw new Error("Failed to save.");
                // Update row in-place
                row.querySelector(".chinese").textContent = formData.get("chinese");
                row.querySelector(".english").textContent = formData.get("english");
                row.querySelector(".notes").textContent = formData.get("notes");
                row.dataset.chinese = formData.get("chinese");
                row.dataset.english = formData.get("english");
                row.dataset.notes = formData.get("notes");

                editRow.remove();
                row.style.display = "";
            })
            .catch(err => alert(err));
        });

        // Cancel button
        editRow.querySelector(".cancelBtn").addEventListener("click", () => {
            editRow.remove();
            row.style.display = "";
        });
    });
});

// Delete buttons
document.querySelectorAll("#glossaryTable .deleteBtn").forEach(btn => {
    btn.addEventListener("click", e => {
        const row = e.target.closest("tr");
        const id = row.dataset.id;
        if (!confirm("Are you sure you want to delete this term?")) return;

        fetch(`/glossary/${id}`, { method: "DELETE" })
            .then(res => {
                if (!res.ok) throw new Error("Failed to delete.");
                row.remove();
            })
            .catch(err => alert(err));
    });
});

// --- Sorting controls ---
document.querySelectorAll("#glossaryTable thead th[data-sort]").forEach(th => {
  th.style.cursor = "pointer";
  th.addEventListener("click", () => {
    const sortBy = th.dataset.sort;
    const url = new URL(window.location.href);
    const currentSortBy = url.searchParams.get("sort_by") || "alpha";
    const currentSortDir = url.searchParams.get("sort_dir") || "asc";

    // If user clicks the same column again, toggle direction
    let newSortDir = "asc";
    if (sortBy === currentSortBy && currentSortDir === "asc") {
      newSortDir = "desc";
    }

    // Preserve current search & pagination params
    const q = url.searchParams.get("q") || "";
    const page = url.searchParams.get("page") || 1;
    const limit = url.searchParams.get("limit") || 20;

    // Build new query string
    const newUrl = `/glossary/?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}&sort_by=${sortBy}&sort_dir=${newSortDir}`;
    window.location.href = newUrl;
  });
});

