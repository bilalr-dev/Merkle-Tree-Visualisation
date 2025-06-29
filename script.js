let currentStep = 0;
let merkleTree = null;
let originalHashes = [];
let filePieces = [];
let simulatedCorruptions = new Set();

const simulateBtn = document.getElementById('simulateBtn');
const clearBtn = document.getElementById('clearBtn');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');

simulateBtn.addEventListener('click', startSimulation);
clearBtn.addEventListener('click', resetSimulation);
fileInput.addEventListener('change', handleFileSelect);

async function sha256(data) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('').substr(0, 16);
}

function updateStepIndicator(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    if (step > 0) {
        document.getElementById(`step${step}`).classList.add('active');
    }
    currentStep = step;
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';
    } else {
        fileInfo.style.display = 'none';
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

async function startSimulation() {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file first');
        return;
    }

    const pieceSize = parseInt(document.getElementById('pieceSize').value);
    const fileContent = await readFileAsText(file);
    
    updateStepIndicator(1);
    filePieces = splitFileIntoPieces(fileContent, pieceSize);
    showFilePieces(filePieces);

    await delay(2000);

    updateStepIndicator(2);
    originalHashes = await hashPieces(filePieces);
    showPieceHashes(filePieces, originalHashes);

    await delay(2000);

    updateStepIndicator(3);
    merkleTree = await buildMerkleTree(originalHashes);
    showMerkleTree(merkleTree);

    await delay(2000);

    updateStepIndicator(4);
    simulateP2PTransfer();
}

function splitFileIntoPieces(content, pieceSize) {
    const pieces = [];
    for (let i = 0; i < content.length; i += pieceSize) {
        pieces.push(content.substr(i, pieceSize));
    }
    return pieces;
}

async function hashPieces(pieces) {
    const hashes = [];
    for (const piece of pieces) {
        hashes.push(await sha256(piece));
    }
    return hashes;
}

async function buildMerkleTree(leafHashes) {
    const tree = [leafHashes];
    let currentLevel = leafHashes;

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = (i + 1 < currentLevel.length) ? currentLevel[i+1] : currentLevel[i];
            nextLevel.push(await sha256(left + right));
        }
        tree.push(nextLevel);
        currentLevel = nextLevel;
    }

    return tree;
}

function showFilePieces(pieces) {
    const html = `
        <div class="animate-in">
            <h3>1. File Divided into Pieces</h3>
            <p>The file is split into ${pieces.length} pieces for efficient transfer.</p>
            <div class="pieces-grid">
                ${pieces.map((_, i) => `
                    <div class="piece" data-index="${i}">Piece ${i+1}</div>
                `).join('')}
            </div>
            <p class="info-note">Each piece is typically 16KB-1MB in actual BitTorrent clients.</p>
        </div>
    `;
    document.getElementById('visualization').innerHTML = html;
}

async function showPieceHashes(pieces, hashes) {
    const html = `
        <div class="animate-in">
            <h3>2. Hashing Each Piece</h3>
            <p>Each piece is hashed using SHA-256. These hashes will form the leaves of our Merkle Tree.</p>
            <div class="pieces-grid">
                ${pieces.map((_, i) => `
                    <div class="piece verified" data-index="${i}">
                        ${hashes[i].substr(0, 8)}...
                    </div>
                `).join('')}
            </div>
            <p class="info-note">Hashes allow verification of piece integrity during transfer.</p>
        </div>
    `;
    document.getElementById('visualization').innerHTML = html;
}

function showMerkleTree(tree) {
    const rootHash = tree[tree.length - 1][0];
    const html = `
        <div class="animate-in">
            <h3>3. Building the Merkle Tree</h3>
            <p>Piece hashes are combined pairwise to form the Merkle Tree. The root hash (<code>${rootHash.substr(0, 12)}...</code>) is included in the torrent file.</p>
            
            <div class="tree-container">
                ${renderTreeLevels(tree)}
            </div>
            
            <div class="verification-path">
                <h4>How Verification Works:</h4>
                <p>To verify a single piece, you only need:</p>
                <div class="verification-steps">
                    <div class="verification-step">
                        <span class="icon">🔍</span> The piece data
                    </div>
                    <div class="verification-step">
                        <span class="icon">🗝️</span> Its hash
                    </div>
                    <div class="verification-step">
                        <span class="icon">🌲</span> The sibling hashes up the tree
                    </div>
                    <div class="verification-step">
                        <span class="icon">👑</span> The root hash (from torrent file)
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('visualization').innerHTML = html;
}

function renderTreeLevels(tree) {
    let html = '';
    const levels = tree.length;
    
    for (let level = levels - 1; level >= 0; level--) {
        const isRoot = level === levels - 1;
        const isLeaf = level === 0;
        const nodes = tree[level];
        
        html += `<div class="tree-level">`;
        
        nodes.forEach((hash, index) => {
            html += `
                <div class="tree-node ${isRoot ? 'root' : ''}" 
                     data-level="${level}" data-index="${index}">
                    ${isRoot ? 'ROOT' : (isLeaf ? `P${index+1}` : `N${level}-${index}`)}
                    <div class="node-hash">${hash.substr(0, 8)}...</div>
                </div>
            `;
        });
        
        html += `</div>`;
        
        if (level > 0) {
            html += `<div class="connection-line"></div>`;
        }
    }
    
    return html;
}

function simulateP2PTransfer() {
    const html = `
        <div class="animate-in">
            <h3>4. Peer-to-Piece Transfer Simulation</h3>
            <p>Downloading pieces from multiple peers with Merkle Tree verification:</p>
            
            <div class="torrent-simulation">
                <div class="peer-container">
                    <div class="peer seeder">
                        <div class="peer-header">Seeder <span class="badge">Complete</span></div>
                        <p>Has all pieces with verified hashes</p>
                        <div class="pieces-grid">
                            ${filePieces.map((_, i) => `
                                <div class="piece verified" data-index="${i}">
                                    ${originalHashes[i].substr(0, 6)}...
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="peer-container">
                        <div class="peer leecher">
                            <div class="peer-header">Your Client <span class="badge">Downloading</span></div>
                            <div class="progress-bar">
                                <div class="progress" style="width: 0%"></div>
                            </div>
                            <p>Receiving pieces from network:</p>
                            <div class="pieces-grid" id="leecherPieces">
                                ${filePieces.map((_, i) => `
                                    <div class="piece missing" 
                                         data-index="${i}" 
                                         onclick="simulatePieceCorruption(${i})">
                                        ?
                                    </div>
                                `).join('')}
                            </div>
                            <button id="verifyBtn" class="verify-button">Verify All Pieces</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="verificationResults" class="verification-results">
                <p>Click on pieces to simulate corruption, then click Verify to check integrity.</p>
            </div>
        </div>
    `;
    
    document.getElementById('visualization').innerHTML = html;
    document.getElementById('verifyBtn').addEventListener('click', verifyDownloadedPieces);
    
    simulateProgressiveDownload();
}

function simulateProgressiveDownload() {
    const pieces = document.querySelectorAll('#leecherPieces .piece');
    const progressBar = document.querySelector('.progress');
    let downloaded = 0;
    
    const downloadInterval = setInterval(() => {
        if (downloaded >= pieces.length) {
            clearInterval(downloadInterval);
            return;
        }
        
        while (downloaded < pieces.length && 
              (pieces[downloaded].classList.contains('verified') || 
               pieces[downloaded].classList.contains('corrupted'))) {
            downloaded++;
        }
        
        if (downloaded < pieces.length) {
            pieces[downloaded].classList.remove('missing');
            pieces[downloaded].classList.add('verified');
            pieces[downloaded].textContent = originalHashes[downloaded].substr(0, 6) + '...';
            downloaded++;
            
            const progress = (downloaded / pieces.length) * 100;
            progressBar.style.width = `${progress}%`;
            
            if (Math.random() < 0.3) { 
                setTimeout(() => {
                    simulatePieceCorruption(downloaded - 1);
                }, 500);
            }
        }
    }, 300);
}

function simulatePieceCorruption(pieceIndex) {
    const pieceElement = document.querySelector(`#leecherPieces .piece[data-index="${pieceIndex}"]`);
    
    if (pieceElement.classList.contains('corrupted')) {
        pieceElement.classList.remove('corrupted');
        pieceElement.classList.add('verified');
        pieceElement.textContent = originalHashes[pieceIndex].substr(0, 6) + '...';
        simulatedCorruptions.delete(pieceIndex);
    } else {
        pieceElement.classList.remove('verified');
        pieceElement.classList.add('corrupted');
        pieceElement.textContent = 'CORRUPT';
        simulatedCorruptions.add(pieceIndex);
    }
}

async function verifyDownloadedPieces() {
    const resultsDiv = document.getElementById('verificationResults');
    const pieces = document.querySelectorAll('#leecherPieces .piece');
    
    const corruptedPieces = [];
    for (let i = 0; i < pieces.length; i++) {
        const pieceElement = pieces[i];
        
        if (pieceElement.classList.contains('missing')) continue;
        
        let isCorrupt;
        if (simulatedCorruptions.has(i)) {
            isCorrupt = true;
        } else {
            const currentHash = await sha256(filePieces[i]);
            isCorrupt = currentHash !== originalHashes[i];
        }
        
        if (isCorrupt) {
            pieceElement.classList.remove('verified');
            pieceElement.classList.add('corrupted');
            corruptedPieces.push(i + 1);
        } else {
            pieceElement.classList.remove('corrupted');
            pieceElement.classList.add('verified');
        }
    }
    
    if (corruptedPieces.length > 0) {
        resultsDiv.innerHTML = `
            <div class="result-error">
                <h4>❌ Verification Failed</h4>
                <p>Corrupted pieces detected: ${corruptedPieces.join(', ')}</p>
                <p>BitTorrent will re-download only these pieces from other peers.</p>
                <p>This is why Merkle Trees are efficient - we don't need to check all pieces, just the affected branches.</p>
            </div>
        `;
        
        highlightVerificationPath(corruptedPieces[0] - 1);
    } else {
        resultsDiv.innerHTML = `
            <div class="result-success">
                <h4>✅ All Pieces Verified Successfully</h4>
                <p>The file is complete and matches the original.</p>
                <p>Root hash: <code>${merkleTree[merkleTree.length - 1][0].substr(0, 16)}...</code></p>
            </div>
        `;
    }
}

function highlightVerificationPath(pieceIndex) {
    document.querySelectorAll('.tree-node').forEach(node => {
        node.classList.remove('highlight-path');
    });
    
    let currentIndex = pieceIndex;
    let level = 0;
    
    while (level < merkleTree.length) {
        const node = document.querySelector(`.tree-node[data-level="${level}"][data-index="${currentIndex}"]`);
        if (node) {
            node.classList.add('highlight-path');
        }
        
        currentIndex = Math.floor(currentIndex / 2);
        level++;
    }
}

function resetSimulation() {
    document.getElementById('visualization').innerHTML = `
        <div class="intro-message">
            <h3>How BitTorrent Uses Merkle Trees</h3>
            <p>BitTorrent breaks files into pieces and verifies their integrity using a Merkle Tree:</p>
            <ol>
                <li>The original seeder creates hashes for each piece</li>
                <li>Hashes are combined into a Merkle Tree</li>
                <li>The root hash is included in the torrent file</li>
                <li>Peers verify each received piece against the tree</li>
            </ol>
            <p>Select a file and click "Simulate Torrent" to begin.</p>
        </div>
    `;
    updateStepIndicator(0);
    merkleTree = null;
    originalHashes = [];
    filePieces = [];
    simulatedCorruptions = new Set();
    fileInput.value = '';
    fileInfo.style.display = 'none';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
