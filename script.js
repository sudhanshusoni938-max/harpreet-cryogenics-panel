const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxrANUUaMSBBRIW-Qc79tWcv9gW-qI2nPGoVqegy8xEp4mKUkJLYZo_lTNOXf6HpKzH/exec";

// LOGIN CREDENTIALS
const USERS = {
    "admin": { password: "admin123", role: "Admin" },
    "staff": { password: "staff123", role: "Staff" }
};

let currentRole = null;
let cylinders = [];
let defaultGases = ["Oxygen", "Nitrogen", "Argon", "CO2", "Helium", "Acetylene", "Hydrogen"];
let defaultCompanies = ["ABC Industries", "XYZ Hospital", "Harpreet Gas"];
let gasChartInstance = null;
let statusChartInstance = null;

function generateAutoCylinderNo() {
    let maxNum = 1000; 
    cylinders.forEach(c => {
        if (c.cylinderNo) {
            let matches = c.cylinderNo.match(/\d+/);
            if (matches) {
                let num = parseInt(matches[0]);
                if (num > maxNum) maxNum = num;
            }
        }
    });
    let nextNumber = `HC-${maxNum + 1}`;
    const cylinderInput = document.getElementById("cylinderNo");
    if (cylinderInput) cylinderInput.value = nextNumber;
}

function handleLogin() {
    const userElem = document.getElementById("loginUsername");
    const passElem = document.getElementById("loginPassword");
    const errorDiv = document.getElementById("loginError");

    if (!userElem || !passElem) return;

    const user = userElem.value.trim().toLowerCase();
    const pass = passElem.value.trim();

    if (USERS[user] && USERS[user].password === pass) {
        currentRole = USERS[user].role;
        localStorage.setItem("userRole", currentRole);
        
        document.getElementById("loginOverlay").classList.add("d-none");
        document.getElementById("appContainer").classList.remove("d-none");
        document.getElementById("displayRoleBadge").textContent = currentRole;

        applyRolePermissions();
        loadCylindersFromGoogleSheet();
        if (errorDiv) errorDiv.classList.add("d-none");
    } else {
        if (errorDiv) errorDiv.classList.remove("d-none");
    }
}

function handleLogout() {
    currentRole = null;
    localStorage.removeItem("userRole");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginOverlay").classList.remove("d-none");
    document.getElementById("appContainer").classList.add("d-none");
}

function applyRolePermissions() {
    const adminOnlyElems = document.querySelectorAll(".admin-only");
    adminOnlyElems.forEach(el => {
        el.style.display = (currentRole === "Admin") ? "" : "none";
    });
}

function loadGasDropdown() {
    let savedGases = JSON.parse(localStorage.getItem("gasList")) || defaultGases;
    const gasSelect = document.getElementById("gasSelect");
    if (!gasSelect) return;
    gasSelect.innerHTML = "";
    savedGases.forEach(gas => {
        let option = document.createElement("option");
        option.value = gas;
        option.textContent = gas;
        gasSelect.appendChild(option);
    });
}

function addNewGas() {
    const gasInput = document.getElementById("newGasInput");
    const newGas = gasInput.value.trim();
    if (!newGas) return alert("Gas name enter kijiye!");
    let savedGases = JSON.parse(localStorage.getItem("gasList")) || defaultGases;
    if (savedGases.some(g => g.toLowerCase() === newGas.toLowerCase())) return alert("Gas pehle se list me hai!");
    savedGases.push(newGas);
    localStorage.setItem("gasList", JSON.stringify(savedGases));
    loadGasDropdown();
    document.getElementById("gasSelect").value = newGas;
    gasInput.value = "";
    alert(`Gas "${newGas}" added successfully!`);
}

function deleteGas() {
    if (currentRole !== 'Admin') return alert("Sirf Admin delete kar sakta hai!");
    const gasSelect = document.getElementById("gasSelect");
    const selectedGas = gasSelect.value;
    if (!selectedGas) return alert("Delete karne ke liye koi gas select karein!");
    if (confirm(`Kya aap "${selectedGas}" ko list se delete karna chahte hain?`)) {
        let savedGases = JSON.parse(localStorage.getItem("gasList")) || defaultGases;
        savedGases = savedGases.filter(g => g !== selectedGas);
        localStorage.setItem("gasList", JSON.stringify(savedGases));
        loadGasDropdown();
        alert(`Gas "${selectedGas}" delete ho gayi!`);
    }
}

function loadCompanyDropdown() {
    let savedCompanies = JSON.parse(localStorage.getItem("companyList")) || defaultCompanies;
    const compSelect = document.getElementById("companySelect");
    if (!compSelect) return;
    compSelect.innerHTML = "";
    savedCompanies.forEach(comp => {
        let option = document.createElement("option");
        option.value = comp;
        option.textContent = comp;
        compSelect.appendChild(option);
    });
}

function addCompany() {
    const compInput = document.getElementById("newCompanyName");
    const newComp = compInput.value.trim();
    if (!newComp) return alert("Company name enter kijiye!");
    let savedCompanies = JSON.parse(localStorage.getItem("companyList")) || defaultCompanies;
    if (savedCompanies.some(c => c.toLowerCase() === newComp.toLowerCase())) return alert("Company pehle se list me hai!");
    savedCompanies.push(newComp);
    localStorage.setItem("companyList", JSON.stringify(savedCompanies));
    loadCompanyDropdown();
    document.getElementById("companySelect").value = newComp;
    compInput.value = "";
    alert(`Company "${newComp}" added successfully!`);
}

function deleteCompany() {
    if (currentRole !== 'Admin') return alert("Sirf Admin delete kar sakta hai!");
    const compSelect = document.getElementById("companySelect");
    const selectedComp = compSelect.value;
    if (!selectedComp) return alert("Delete karne ke liye koi company select karein!");
    if (confirm(`Kya aap "${selectedComp}" ko list se delete karna chahte hain?`)) {
        let savedCompanies = JSON.parse(localStorage.getItem("companyList")) || defaultCompanies;
        savedCompanies = savedCompanies.filter(c => c !== selectedComp);
        localStorage.setItem("companyList", JSON.stringify(savedCompanies));
        loadCompanyDropdown();
        alert(`Company "${selectedComp}" delete ho gayi!`);
    }
}

function showSection(sectionId, navElement) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('d-none'));
    document.getElementById(sectionId).classList.remove('d-none');
    if(navElement) {
        document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
        navElement.classList.add('active');
    }
    if(sectionId === 'godownSection') updateGodownStockDetails();
    if(sectionId === 'ledgerSection') updateCustomerLedger();
    if(sectionId === 'holdingSection') updateHoldingAlerts();
    if(sectionId === 'reportsSection') renderCharts();
}

function filterCylinders() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = cylinders.filter(c => 
        c.cylinderNo.toLowerCase().includes(query) ||
        c.company.toLowerCase().includes(query) ||
        c.gas.toLowerCase().includes(query) ||
        c.status.toLowerCase().includes(query)
    );
    displayCylinders(filtered);
}

function exportToCSV() {
    if (cylinders.length === 0) return alert("Export karne ke liye koi data nahi hai!");
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Cylinder No,Company,Gas,Capacity,Quantity,Status,Location\n";
    cylinders.forEach(c => {
        let row = `"${c.date || ''}","${c.cylinderNo}","${c.company}","${c.gas}","${c.capacity}",${c.quantity || 1},"${c.status}","${c.location || 'Godown'}"`;
        csvContent += row + "\n";
    });
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Harpreet_Cryogenics_Stock.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function submitCylinderEntry() {
    const cylinderNo = document.getElementById("cylinderNo").value.trim();
    const company = document.getElementById("companySelect").value;
    const gas = document.getElementById("gasSelect").value;
    const capacity = document.getElementById("capacity").value;
    const status = document.getElementById("statusSelect").value;
    const quantity = parseInt(document.getElementById("quantity").value) || 1;

    if (!cylinderNo) return alert("Cylinder No. daliye!");

    let location = "Godown";
    if (status === "Out Stock") location = "Customer Site";
    else if (status === "Refill") location = "Refill Plant";
    else if (status === "Empty") location = "Godown Yard";
    else if (status === "Damaged") location = "Repair Workshop";

    const entryDate = new Date().toISOString().split('T')[0];
    const cylinderData = { date: entryDate, cylinderNo, company, gas, capacity, quantity, status, location };

    cylinders.unshift(cylinderData);
    displayCylinders();
    updateDashboard();

    document.getElementById("quantity").value = 1;
    generateAutoCylinderNo();

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(cylinderData)
        });
        alert(`Cylinder ${cylinderNo} entry saved as ${status}!`);
    } catch (err) { console.error(err); }
}

function displayCylinders(dataList = cylinders) {
    const table = document.getElementById("cylinderTable");
    if (!table) return;
    table.innerHTML = "";
    dataList.forEach((cylinder, index) => {
        let statusClass = "bg-secondary text-white";
        if (cylinder.status === 'In Stock') statusClass = 'bg-success-subtle text-success';
        else if (cylinder.status === 'Out Stock') statusClass = 'bg-danger-subtle text-danger';
        else if (cylinder.status === 'Refill' || cylinder.status === 'Empty') statusClass = 'bg-warning-subtle text-warning';

        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="fw-bold">${cylinder.cylinderNo}</td>
            <td>${cylinder.company}</td>
            <td>${cylinder.gas}</td>
            <td>${cylinder.capacity}</td>
            <td><span class="badge ${statusClass} fw-bold">${cylinder.status}</span></td>
            <td>${cylinder.location || 'Godown'}</td>
            <td class="fw-bold text-center text-primary">${cylinder.quantity || 1}</td>
            <td>${cylinder.date || '2026-08-10'}</td>
            <td class="admin-only">
              <button class="btn btn-sm btn-outline-danger" onclick="deleteCylinder(${index})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        table.appendChild(row);
    });
    applyRolePermissions();
}

async function deleteCylinder(index) {
    if (currentRole !== 'Admin') return alert("Staff members record delete nahi kar sakte!");
    let cylinderToDelete = cylinders[index];
    if (confirm(`Kya aap Cylinder No. "${cylinderToDelete.cylinderNo}" ko permanently delete karna chahte hain?`)) {
        cylinders.splice(index, 1);
        displayCylinders();
        updateDashboard();
        generateAutoCylinderNo();
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "deleteCylinder", cylinderNo: cylinderToDelete.cylinderNo })
            });
            alert("Cylinder record permanently delete ho gaya!");
        } catch (err) { console.error("Delete error:", err); }
    }
}

function updateGodownStockDetails() {
    const partyTable = document.getElementById("godownPartyTableBody");
    const cylindersTable = document.getElementById("godownCylindersListBody");
    const godownTotalElement = document.getElementById("godownTotalCount");
    if (!partyTable || !cylindersTable) return;
    partyTable.innerHTML = "";
    cylindersTable.innerHTML = "";
    let godownParties = {};
    let totalGodownCount = 0;
    cylinders.forEach(c => {
        if (c.status === "In Stock" || c.status === "Empty" || c.location === "Godown" || c.location === "Godown Yard") {
            let comp = c.company || "Unknown Party";
            let qty = parseInt(c.quantity) || 1;
            totalGodownCount += qty;
            if (!godownParties[comp]) godownParties[comp] = { full: 0, empty: 0, damaged: 0, total: 0 };
            if (c.status === "In Stock") godownParties[comp].full += qty;
            else if (c.status === "Empty" || c.status === "Refill") godownParties[comp].empty += qty;
            else if (c.status === "Damaged") godownParties[comp].damaged += qty;
            godownParties[comp].total += qty;

            let listRow = document.createElement("tr");
            listRow.innerHTML = `
                <td class="fw-bold">${c.cylinderNo}</td>
                <td><span class="badge bg-light text-dark fw-bold border">${comp}</span></td>
                <td>${c.gas}</td>
                <td>${c.capacity}</td>
                <td><span class="badge ${c.status === 'In Stock' ? 'bg-success' : 'bg-warning text-dark'}">${c.status}</span></td>
                <td>${c.date || '2026-08-10'}</td>
            `;
            cylindersTable.appendChild(listRow);
        }
    });
    if (godownTotalElement) godownTotalElement.textContent = totalGodownCount;
    Object.keys(godownParties).forEach(party => {
        let p = godownParties[party];
        let pRow = document.createElement("tr");
        pRow.innerHTML = `<td class="fw-bold">${party}</td><td class="text-center text-success fw-bold">${p.full}</td><td class="text-center text-warning fw-bold">${p.empty}</td><td class="text-center text-danger fw-bold">${p.damaged}</td><td class="text-center fw-bold bg-light">${p.total}</td>`;
        partyTable.appendChild(pRow);
    });
}

function trackCylinderHistory() {
    const searchNo = document.getElementById("trackerSearchInput").value.trim().toLowerCase();
    const timeline = document.getElementById("historyTimeline");
    if (!searchNo) return alert("Cylinder No. enter kijiye!");
    const history = cylinders.filter(c => c.cylinderNo.toLowerCase() === searchNo);
    timeline.innerHTML = "";
    if (history.length === 0) {
        timeline.innerHTML = `<li class="list-group-item text-danger fw-bold">No movement record found!</li>`;
        return;
    }
    history.forEach((h, idx) => {
        let item = document.createElement("li");
        item.className = "list-group-item d-flex justify-content-between align-items-center py-3";
        item.innerHTML = `<div><span class="badge bg-primary me-2">Step ${history.length - idx}</span><strong>${h.company}</strong> par status hua <span class="badge bg-info text-dark">${h.status}</span> (${h.location}) - Qty: ${h.quantity || 1}</div><small class="text-muted"><i class="fas fa-clock me-1"></i>${h.date || 'Today'}</small>`;
        timeline.appendChild(item);
    });
}

function updateHoldingAlerts() {
    const table = document.getElementById("holdingTableBody");
    if (!table) return;
    table.innerHTML = "";
    const today = new Date();
    cylinders.forEach(c => {
        if (c.status === "Out Stock" || c.location === "Customer Site") {
            let issueDate = c.date ? new Date(c.date) : new Date();
            let diffDays = Math.ceil(Math.abs(today - issueDate) / (1000 * 60 * 60 * 24));
            let penalty = (diffDays > 30) ? (diffDays - 30) * 50 : 0;
            let row = document.createElement("tr");
            row.className = diffDays > 30 ? "table-danger" : "";
            row.innerHTML = `<td class="fw-bold">${c.cylinderNo}</td><td>${c.company}</td><td>${c.date || '2026-08-10'}</td><td class="fw-bold text-center">${diffDays} Days</td><td><span class="badge bg-warning text-dark">${diffDays > 30 ? 'OVERDUE' : 'Holding'}</span></td><td class="fw-bold text-danger text-end">₹${penalty}</td>`;
            table.appendChild(row);
        }
    });
}

function renderCharts() {
    let gasCounts = {};
    let statusCounts = { "In Stock": 0, "Out Stock": 0, "Refill/Empty": 0, "Damaged": 0 };
    cylinders.forEach(c => {
        let qty = parseInt(c.quantity) || 1;
        gasCounts[c.gas] = (gasCounts[c.gas] || 0) + qty;
        if (c.status === "In Stock") statusCounts["In Stock"] += qty;
        else if (c.status === "Out Stock") statusCounts["Out Stock"] += qty;
        else if (c.status === "Refill" || c.status === "Empty") statusCounts["Refill/Empty"] += qty;
        else if (c.status === "Damaged") statusCounts["Damaged"] += qty;
    });
    const ctx1 = document.getElementById('gasChart').getContext('2d');
    if (gasChartInstance) gasChartInstance.destroy();
    gasChartInstance = new Chart(ctx1, { type: 'pie', data: { labels: Object.keys(gasCounts), datasets: [{ data: Object.values(gasCounts), backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0'] }] } });

    const ctx2 = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctx2, { type: 'bar', data: { labels: Object.keys(statusCounts), datasets: [{ label: 'Cylinder Count', data: Object.values(statusCounts), backgroundColor: ['#198754', '#dc3545', '#ffc107', '#212529'] }] } });
}

function updateCustomerLedger() {
    const ledgerTable = document.getElementById("ledgerTableBody");
    if (!ledgerTable) return;
    let customerData = {};
    cylinders.forEach(c => {
        let comp = c.company || "Unknown";
        let qty = parseInt(c.quantity) || 1;
        if (!customerData[comp]) customerData[comp] = { inStock: 0, outStock: 0, refill: 0, damaged: 0, total: 0 };
        if (c.status === "In Stock") customerData[comp].inStock += qty;
        else if (c.status === "Out Stock") customerData[comp].outStock += qty;
        else if (c.status === "Refill" || c.status === "Empty") customerData[comp].refill += qty;
        else if (c.status === "Damaged") customerData[comp].damaged += qty;
        customerData[comp].total += qty;
    });
    ledgerTable.innerHTML = "";
    Object.keys(customerData).forEach(customer => {
        let d = customerData[customer];
        let row = document.createElement("tr");
        row.innerHTML = `<td class="fw-bold">${customer}</td><td class="text-center text-success">${d.inStock}</td><td class="text-center text-danger">${d.outStock}</td><td class="text-center text-warning">${d.refill}</td><td class="text-center text-secondary">${d.damaged}</td><td class="text-center fw-bold">${d.total}</td>`;
        ledgerTable.appendChild(row);
    });
}

function updateDashboard() {
    let total = 0, full = 0, refill = 0, customer = 0, damaged = 0;
    cylinders.forEach(c => {
        let qty = parseInt(c.quantity) || 1;
        total += qty;
        if (c.status === "In Stock") full += qty;
        else if (c.status === "Out Stock") customer += qty;
        else if (c.status === "Refill" || c.status === "Empty") refill += qty;
        else if (c.status === "Damaged") damaged += qty;
    });
    if(document.getElementById("totalCylinders")) document.getElementById("totalCylinders").textContent = total;
    if(document.getElementById("fullCylinders")) document.getElementById("fullCylinders").textContent = full;
    if(document.getElementById("emptyCylinders")) document.getElementById("emptyCylinders").textContent = refill;
    if(document.getElementById("customerCylinders")) document.getElementById("customerCylinders").textContent = customer;
    if(document.getElementById("damagedCylinders")) document.getElementById("damagedCylinders").textContent = damaged;
}

async function loadCylindersFromGoogleSheet() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL + "?action=getCylinders");
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            cylinders = result.data;
            displayCylinders();
            updateDashboard();
            generateAutoCylinderNo();
        }
    } catch (error) { 
        console.error(error); 
        generateAutoCylinderNo();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadGasDropdown();
    loadCompanyDropdown();
    const passInput = document.getElementById("loginPassword");
    if (passInput) {
        passInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") handleLogin();
        });
    }
    const savedRole = localStorage.getItem("userRole");
    if (savedRole) {
        currentRole = savedRole;
        if (document.getElementById("loginOverlay")) document.getElementById("loginOverlay").classList.add("d-none");
        if (document.getElementById("appContainer")) document.getElementById("appContainer").classList.remove("d-none");
        if (document.getElementById("displayRoleBadge")) document.getElementById("displayRoleBadge").textContent = currentRole;
        applyRolePermissions();
        loadCylindersFromGoogleSheet();
    }
});
