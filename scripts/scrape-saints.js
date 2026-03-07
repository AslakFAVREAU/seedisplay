#!/usr/bin/env node

/**
 * Scrape saints from https://www.lejourduseigneur.com/saints
 * Generates/updates ephe.csv with French Catholic saints
 * 
 * Ignores mobile holidays (Pâques, Pentecôte, Lundi Pâques, etc)
 * Detects gender from "Sainte" vs "Saint" prefix
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Mobile holidays and non-saint entries to ignore
const IGNORE_KEYWORDS = [
  'Pâques', 'Pentecôte', 'Ascension', 'Lundi', 'Mardi Gras', 'Rameaux',
  'Transfiguration', 'Toussaint', 'Défunts', 'Poisson', 'Épiphanie',
  'Chandeleur', 'Annonciation', 'Croix', 'Notre-Dame', 'Apôtres',
  'Présentation', 'Immaculée', 'Nativité'
];

// Parse date from format "01 janvier" to "01/01"
function parseDate(dateStr) {
  const months = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
  };
  
  const parts = dateStr.toLowerCase().trim().split(/\s+/);
  if (parts.length < 2) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = months[parts[1]];
  
  return month ? `${day}/${month}` : null;
}

// Clean saint text but keep full name (e.g., "Félicité et Perpétue" not just "Félicité")
function cleanSaintName(saintText) {
  // Remove titles only (keep "et" and full names)
  let text = saintText
    .replace(/^Saintes?\s+/i, '')
    .replace(/^Saints?\s+/i, '')
    .replace(/\s*\([^)]+\)$/i, '') // Remove (aliases) at end
    .trim();
  
  // Capitalize each word properly
  return text.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// OLD: Extract main first name from "Sainte Marie Mère de Dieu" => "Marie"
function extractMainName(saintText) {
  // Remove titles and qualifiers
  let text = saintText
    .replace(/^Saintes?\s+/i, '')
    .replace(/^Saints?\s+/i, '')
    .replace(/\s*\([^)]+\)$/i, '') // Remove (aliases)
    .replace(/\s+et\s+.*/i, '') // Remove "et ..." for multiple saints
    .trim();
  
  // Take first word only
  const match = text.match(/^([A-ZÀ-ÿ]+(?:-[A-ZÀ-ÿ]+)?)\b/i);
  return match ? match[1] : null;
}

// Detect gender from original text
function detectGender(saintText) {
  const isFemale = /^Sainte\s/i.test(saintText);
  return isFemale ? 'f' : 'm';
}

// Check if entry should be ignored
function shouldIgnore(saintText) {
  return IGNORE_KEYWORDS.some(keyword => 
    saintText.toLowerCase().includes(keyword.toLowerCase())
  );
}

async function scrapeSaints() {
  console.log('🔄 Scraping saints from lejourduseigneur.com...');
  
  const saints = new Map(); // { "DD/MM": { name, gender } }
  let pageNum = 1;
  let totalProcessed = 0;
  
  while (pageNum <= 40) { // Max 40 pages (365+ days)
    try {
      const url = pageNum === 1 
        ? 'https://www.lejourduseigneur.com/saints'
        : `https://www.lejourduseigneur.com/saints?page=${pageNum}`;
      
      console.log(`📄 Page ${pageNum}...`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const tiles = $('.saintTile');
      
      if (tiles.length === 0) {
        console.log('   No tiles found on this page. Stopping.');
        break;
      }
      
      let pageAdded = 0;
      tiles.each((i, tile) => {
        const $tile = $(tile);
        const tileText = $tile.text();
        
        // Extract date
        const dateMatch = tileText.match(/(\d{2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i);
        if (!dateMatch) return;
        
        const date = parseDate(`${dateMatch[1]} ${dateMatch[2]}`);
        if (!date || saints.has(date)) return; // Skip if already have this date
        
        // Extract saint name from link
        const link = $tile.find('a[href*="/saint/"]');
        const saintText = link.text().trim();
        
        if (!saintText || shouldIgnore(saintText)) return;
        
        // Clean and keep full name (e.g., "Félicité et Perpétue")
        const fullName = cleanSaintName(saintText);
        if (!fullName || fullName.length < 2) return;
        
        const gender = detectGender(saintText);
        saints.set(date, { name: fullName, gender });
        pageAdded++;
        totalProcessed++;
      });
      
      console.log(`   Added ${pageAdded} saints`);
      
      if (pageAdded === 0) {
        // No new saints on this page, might be end
        const nextPageLinks = $('a:contains("Page suivante"), a:contains("Next")');
        if (nextPageLinks.length === 0) {
          console.log('   No next page found. Taking last 5 pages to confirm end...');
          pageNum += 5;
          if (pageNum > 40) break;
        } else {
          pageNum++;
        }
      } else {
        pageNum++;
      }
      
      // Polite delay
      await new Promise(r => setTimeout(r, 800));
      
    } catch (error) {
      console.error(`❌ Error on page ${pageNum}:`, error.message);
      break;
    }
  }
  
  console.log(`\n✅ Total saints scraped: ${saints.size}`);
  return saints;
}

async function mergeWithExisting(newSaints) {
  const csvPath = path.join(__dirname, '../ephe.csv');
  
  // Read existing CSV
  let existing = new Map();
  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim() || line.startsWith('VERSION')) continue;
      const [date, type, name] = line.split(',');
      if (date && name) {
        existing.set(date, { name: name.trim(), type: type || '2' });
      }
    }
  }
  
  console.log(`\n📊 Existing CSV: ${existing.size} entries`);
  console.log(`   New saints found: ${newSaints.size} entries`);
  
  // Merge: REPLACE with new data (from scraping), keep gaps from existing
  let merged = new Map();
  
  // First, add all existing entries
  for (const [date, data] of existing) {
    merged.set(date, data);
  }
  
  // Then REPLACE with new scraped data (overwrite if exists)
  let replacedCount = 0;
  let addedCount = 0;
  
  for (const [date, { name, gender }] of newSaints) {
    if (merged.has(date)) {
      // Check if name changed
      if (merged.get(date).name !== name) {
        replacedCount++;
      }
    } else {
      addedCount++;
    }
    merged.set(date, { name, type: '2' });
  }
  
  console.log(`   Replaced: ${replacedCount} entries with updated names`);
  console.log(`   Added: ${addedCount} new entries`);
  
  // Sort by month then day (MM/DD)
  const sortedEntries = Array.from(merged.entries()).sort((a, b) => {
    const [dayA, monthA] = a[0].split('/').map(Number);
    const [dayB, monthB] = b[0].split('/').map(Number);
    return monthA === monthB ? dayA - dayB : monthA - monthB;
  });
  
  // Write CSV
  let csv = 'VERSION,1\n';
  for (const [date, data] of sortedEntries) {
    csv += `${date},${data.type},${data.name}\n`;
  }
  
  fs.writeFileSync(csvPath, csv, 'utf-8');
  console.log(`\n✅ Updated ephe.csv`);
  console.log(`📊 Total entries: ${merged.size}`);
}

async function main() {
  try {
    const saints = await scrapeSaints();
    
    if (saints.size > 0) {
      await mergeWithExisting(saints);
    } else {
      console.warn('⚠️ No saints found.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
