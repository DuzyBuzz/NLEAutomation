import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath } from 'puppeteer';

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

puppeteer.use(StealthPlugin());

// Ensure output directory exists
const ensureOutputDir = () => {
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
};

// Function to save JSON files
function outputJSON(filePath: string, data: any) {
    ensureOutputDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ JSON saved to: ${filePath}`);
}

// Convert CSV to JSON
function csvToJsonFromFile(filePath: string, options = { header: true, delimiter: ',' }): any[] {
    const csvContent = fs.readFileSync(path.resolve(filePath), 'utf8');
    const result = Papa.parse(csvContent, { header: options.header, delimiter: options.delimiter, skipEmptyLines: true });

    if (result.errors.length) {
        throw new Error(`CSV Parsing Error: ${result.errors.map(err => err.message).join(', ')}`);
    }

    return result.data;
}

// Convert JSON to Excel
function convertJsonToExcel(jsonArray: any[], fileName: string) {
    if (!jsonArray.length) return;
    ensureOutputDir();

    const headers = ["PRECINCT_ID", "REGION", "PROVINCE", "MUNICIPALITY", "BARANGAY", "RISA", "AKBAYAN", "VOTERS_VOTED", "TURNOUT"];
    const worksheet = XLSX.utils.json_to_sheet(jsonArray, { header: headers });

    // Ensure all numbers are correctly formatted
    headers.forEach(header => {
        if (["RISA", "AKBAYAN", "VOTERS_VOTED", "TURNOUT"].includes(header)) {
            jsonArray.forEach(row => {
                row[header] = row[header] || 0;  // Ensure 0 instead of blank
            });
        }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Election Results");
    XLSX.writeFile(workbook, `output/${fileName}.xlsx`);

    console.log(`✅ Excel file saved: output/${fileName}.xlsx`);
}

// Convert JSON to CSV
function convertJsonToCsv(jsonArray: any[], fileName: string) {
    if (!jsonArray.length) return;
    ensureOutputDir();

    const headers = Object.keys(jsonArray[0]);
    const csvRows = jsonArray.map(row => 
        headers.map(header => {
            const value = row[header] ?? 0; // Ensure 0 instead of blank
            return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(",")
    );

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    fs.writeFileSync(`output/${fileName}.csv`, csvContent, 'utf8');
    console.log(`✅ CSV file saved: output/${fileName}.csv`);
}

// Extract location details
function parseLocation(location: string) {
    const [REGION, PROVINCE, MUNICIPALITY, BARANGAY] = location.split(',').map(s => s.trim());
    return { REGION, PROVINCE, MUNICIPALITY, BARANGAY };
}

// Scrape data using Puppeteer (with retries)
async function extractCandidateData(url: string, retries: number = 3): Promise<any | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const browser = await puppeteer.launch({ headless: true, executablePath: executablePath() });
        const page = await browser.newPage();

        try {
            console.log(`🕵️ Attempt ${attempt}: Fetching data from ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            await page.waitForSelector('#cclass\\.14', { timeout: 5000 });
            await page.waitForSelector('div[ng-if="showCommonInfo"]', { timeout: 5000 });

            const senate = await page.evaluate(() => {
                const div = document.querySelector('#cclass\\.14');
                if (!div) return { LDL: 0, CTB: 0 };

                let result = { LDL: 0, CTB: 0 };
                div.querySelectorAll('.candidate-row').forEach(row => {
                    const candidateName = row.querySelector('.candidate-info')?.textContent?.trim();
                    const votes = row.querySelector('.candidate-contest-result')?.textContent?.trim()?.replace(/,/g, '');

                    if (votes && candidateName) {
                        if (candidateName === 'HONTIVEROS, RISA (AKBAYAN)') result.LDL = parseInt(votes, 10) || 0;
                        else if (candidateName === 'AKBAYAN') result.CTB = parseInt(votes, 10) || 0;
                    }
                });
                return result;
            });

            const commonInfo = await page.evaluate(() => {
                const div = document.querySelector('div[ng-if="showCommonInfo"]');
                if (!div) return { voters_voted: 0, turnout: 0, location: '' };

                return {
                    voters_voted: parseInt(div.querySelectorAll('.gen-inf-row')[6]?.querySelector('.gen-inf-value')?.textContent?.trim()?.replace(/,/g, '') || '0', 10) || 0,
                    turnout: parseFloat(div.querySelectorAll('.gen-inf-row')[9]?.querySelector('.gen-inf-value')?.textContent?.trim()?.replace(/[^0-9.]/g, '') || '0') || 0,
                    location: div.querySelectorAll('.gen-inf-row')[1]?.querySelector('.gen-inf-value')?.textContent?.trim() || ''
                };
            });

            await browser.close();
            return { ...senate, ...commonInfo };

        } catch (error) {
            console.error(`❌ Attempt ${attempt} failed:`, error);
            if (attempt === retries) {
                await browser.close();
                return null; // Return null only after exhausting all attempts
            }
        } finally {
            await browser.close();
        }
    }
}

// Main function
async function main() {
    let records: any[] = [];
    let failedGet: any[] = [];

    let csvData: any[] = [];
    let csvLoc = [
        './csv/BUENAVISTA.csv',
        './csv/JORDAN.csv',
        './csv/NUEVA VALENCIA.csv',
        './csv/SAN LORENZO.csv',
        './csv/SIBUNAG.csv'
    ];

    for (let csv of csvLoc) {
        csvData.push(...csvToJsonFromFile(csv));
    }

    console.log('TOTAL PRECINCT: ', csvData.length);
    let count = 0;

    for (let precinct of csvData) {
        try {
            let url = `https://2022electionresults.comelec.gov.ph/#/er/${precinct.PRECINCT_ID}/local`;
            let res = await extractCandidateData(url);

            if (!res) {
                console.log(`Skipping PRECINCT_ID: ${precinct.PRECINCT_ID} (No Data Found)`);
                failedGet.push(precinct);
                continue;
            }

            let { REGION, PROVINCE, MUNICIPALITY, BARANGAY } = parseLocation(res.location);
            let finalRec = { 
                PRECINCT_ID: precinct.PRECINCT_ID, 
                REGION, 
                PROVINCE, 
                MUNICIPALITY, 
                BARANGAY, 
                RISA: res.LDL || 0, 
                AKBAYAN: res.CTB || 0, 
                VOTERS_VOTED: res.voters_voted || 0, 
                TURNOUT: res.turnout || 0 
            };

            records.push(finalRec);
            console.log(`✅ Precinct ${++count}: ${precinct.PRECINCT_ID}`);
        } catch (error) {
            console.error(`❌ Error processing PRECINCT_ID: ${precinct.PRECINCT_ID}`, error);
            failedGet.push(precinct);
        }
    }

    outputJSON('./output/non_consolidated.json', records);
    convertJsonToCsv(records, 'non_consolidated');
    convertJsonToExcel(records, 'non_consolidated');
    outputJSON('./output/failedPrecinct.json', failedGet);
    convertJsonToCsv(failedGet, 'failedPrecinct');
    convertJsonToExcel(failedGet, 'failedPrecinct');
}

main();
