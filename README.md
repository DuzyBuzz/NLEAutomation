# Election Results Scraper

This project is a **Puppeteer-based web scraper** designed to extract election results for specific precincts from the **2022 Philippine Election Results** website. The extracted data is saved in JSON, CSV, and Excel formats.

## Features
- Uses **Puppeteer with stealth plugin** to bypass bot detection.
- Scrapes election data, including:
  - Candidate votes for **HONTIVEROS, RISA (AKBAYAN)** and **AKBAYAN** party.
  - **Voter turnout** and total **voters voted**.
  - **Precinct location details** (Region, Province, Municipality, Barangay).
- **Retries failed requests up to 3 times** before marking them as failed.
- Saves the extracted data in **JSON, CSV, and Excel** formats.
- Generates a separate file for **failed precincts** that couldn't be scraped.

## Prerequisites
- **Node.js** (version 16 or later recommended)
- **npm** or **yarn**

## Installation
1. Clone the repository:
   ```sh
   git clone https://github.com/your-repo/election-scraper.git
   cd election-scraper
   ```
2. Install dependencies:
   ```sh
   npm install
   ```

## Usage
### 1. Prepare CSV Files
Ensure that the CSV files containing the list of precincts are placed inside the `csv/` folder. The expected CSV format:

| PRECINCT_ID |
|------------|
| 123456     |
| 789012     |
| ...        |

### 2. Run the Scraper
Start the scraper with:
```sh
npm start
```

### 3. Output Files
Scraped data will be saved inside the `output/` folder:
- `non_consolidated.json`, `non_consolidated.csv`, `non_consolidated.xlsx`: Successfully scraped precincts.
- `failedPrecinct.json`, `failedPrecinct.csv`, `failedPrecinct.xlsx`: Precincts that failed to be scraped.

## Code Breakdown
### `extractCandidateData(url, retries)`
- Scrapes election results from the given precinct URL.
- Retries up to **3 times** if data fetching fails.
- Extracts votes, voter turnout, and location details.

### `csvToJsonFromFile(filePath)`
- Converts CSV files into JSON format for processing.

### `convertJsonToCsv(jsonArray, fileName)`
- Converts JSON data into a CSV file.

### `convertJsonToExcel(jsonArray, fileName)`
- Converts JSON data into an Excel file.

## Error Handling
- If a precinct's data cannot be retrieved, it is logged in `failedPrecinct.json`.
- All errors encountered during scraping are displayed in the console.

## License
This project is licensed under the **MIT License**.

---

### 💡 **Future Improvements**
- Support additional candidates and parties.
- Implement a queue system for better request handling.
- Improve error handling for various website changes.

Happy scraping! 🚀

