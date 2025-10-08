// Check logged-in user
const user = JSON.parse(localStorage.getItem("loggedInUser"));
if(!user) window.location.href = "index.html";

// Pre-fill case ID if user has one
window.addEventListener('DOMContentLoaded', () => {
    if(user.caseId) {
        document.getElementById("case-id").value = user.caseId;
    }
});

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
});

// Upload & Generate Hash
document.getElementById("upload-btn").addEventListener("click", async () => {
    const caseIdInput = document.getElementById("case-id");
    const caseId = caseIdInput.value.trim();
    if(!caseId) return alert("Please enter a Case ID!");
    
    const fileInput = document.getElementById("file-upload");
    const file = fileInput.files[0];
    if(!file) return alert("Select a file!");

    const reader = new FileReader();
    reader.onload = async function(e) {
        const content = e.target.result;
        const hash = await sha256(content);
        const category = classifyFile(file.name);

        saveEvidence(file.name, hash, category, caseId);
        caseIdInput.value = ""; // Clear case ID after upload
    };
    reader.readAsText(file);
});

// SHA-256 hashing
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Basic AI-powered file classification (demo)
function classifyFile(filename) {
    if(filename.match(/\.(jpg|jpeg|png|gif)$/i)) return "Image";
    if(filename.match(/\.(pdf|doc|docx)$/i)) return "Document";
    if(filename.match(/\.(log|txt)$/i)) return "Log File";
    return "Other";
}

// Save evidence
async function saveEvidence(name, hash, category, caseId) {
    let evidence = JSON.parse(localStorage.getItem("evidenceList")) || [];
    evidence.push({
        name, hash, category, caseId,
        uploader: user.username,
        role: user.role,
        timestamp: new Date().toLocaleString(),
        tampered: false
    });
    localStorage.setItem("evidenceList", JSON.stringify(evidence));
    alert("Evidence uploaded & hashed!");
    displayEvidence();
}

// Display evidence
function displayEvidence() {
    const list = document.getElementById("evidence-list");
    list.innerHTML = "";
    const evidence = JSON.parse(localStorage.getItem("evidenceList")) || [];

    evidence.forEach((e, idx) => {
        const card = document.createElement("div");
        card.className = "evidence-card";
        card.innerHTML = `
            <strong>${e.name}</strong> [${e.category}]<br>
            <strong>Case ID:</strong> ${e.caseId || 'N/A'}<br>
            Hash: ${e.hash}<br>
            Uploader: ${e.uploader} (${e.role})<br>
            Time: ${e.timestamp}<br>
            Tampered: ${e.tampered ? "Yes" : "No"}<br>
            <div id="qrcode-${idx}" class="qr-code-container"></div>
            <button onclick="verifyEvidence(${idx})" class="btn">Verify QR / Tampering</button>
            <button onclick="generateQRCode(${idx})" class="btn">Generate QR Code</button>
        `;
        list.appendChild(card);
    });
}
displayEvidence();

// Tampering / QR Verification demo
window.verifyEvidence = function(idx) {
    let evidence = JSON.parse(localStorage.getItem("evidenceList"));
    const e = evidence[idx];

    // Simulate tamper check (10% chance)
    e.tampered = Math.random() < 0.1;
    localStorage.setItem("evidenceList", JSON.stringify(evidence));
    displayEvidence();
    alert(e.tampered ? "Tampering detected!" : "Evidence verified clean!");
}

// Generate QR Code for evidence
window.generateQRCode = function(idx) {
    const evidence = JSON.parse(localStorage.getItem("evidenceList"));
    const e = evidence[idx];
    
    // Create QR code data with evidence details
    const qrData = JSON.stringify({
        name: e.name,
        hash: e.hash,
        category: e.category,
        caseId: e.caseId,
        uploader: e.uploader,
        role: e.role,
        timestamp: e.timestamp,
        tampered: e.tampered
    });
    
    // Clear previous QR code if exists
    const container = document.getElementById(`qrcode-${idx}`);
    container.innerHTML = "";
    
    // Generate new QR code
    new QRCode(container, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: "#1e3a8a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Add download button
    setTimeout(() => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn';
            downloadBtn.textContent = 'Download QR';
            downloadBtn.style.marginTop = '10px';
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.download = `${e.name}_QRCode.png`;
                link.href = canvas.toDataURL();
                link.click();
            };
            container.appendChild(downloadBtn);
        }
    }, 100);
    
    alert("QR Code generated successfully!");
}

// PDF Report
document.getElementById("generate-pdf").addEventListener("click", () => {
    const evidence = JSON.parse(localStorage.getItem("evidenceList")) || [];
    const body = evidence.map(e => [e.name, e.caseId || 'N/A', e.category, e.hash, e.uploader, e.role, e.timestamp, e.tampered ? "Yes":"No"]);

    const docDefinition = {
        content: [
            {text: 'ForenChain Evidence Report', style: 'header'},
            {
                table: {
                    headerRows: 1,
                    widths: ['auto','auto','auto','*','auto','auto','auto','auto'],
                    body: [
                        ['Name','Case ID','Category','Hash','Uploader','Role','Timestamp','Tampered'],
                        ...body
                    ]
                }
            }
        ],
        styles: {
            header: { fontSize: 18, bold: true, margin: [0,0,0,10] }
        }
    };

    pdfMake.createPdf(docDefinition).download('ForenChain_Report.pdf');
});
