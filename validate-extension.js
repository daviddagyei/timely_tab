#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');

console.log('🔍 Validating Chrome Extension...\n');

// Check if dist directory exists
if (!fs.existsSync(distPath)) {
  console.error('❌ dist/ directory not found');
  process.exit(1);
}

// Required files for Chrome extension
const requiredFiles = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'options.html',
  'options.js',
  'icon.png',
  'styles.css'
];

// Check if all required files exist
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Validate manifest.json
try {
  const manifestPath = path.join(distPath, 'manifest.json');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  console.log('\n📋 Manifest validation:');
  console.log(`✅ Manifest version: ${manifest.manifest_version}`);
  console.log(`✅ Extension name: ${manifest.name}`);
  console.log(`✅ Version: ${manifest.version}`);
  
  // Check required permissions
  const requiredPermissions = ['storage', 'alarms', 'notifications'];
  const hasAllPermissions = requiredPermissions.every(perm => 
    manifest.permissions && manifest.permissions.includes(perm)
  );
  
  if (hasAllPermissions) {
    console.log(`✅ All required permissions present`);
  } else {
    console.log(`❌ Missing required permissions`);
    allFilesExist = false;
  }
  
  // Check background script
  if (manifest.background && manifest.background.service_worker) {
    console.log(`✅ Background service worker: ${manifest.background.service_worker}`);
  } else {
    console.log(`❌ Background service worker not configured`);
    allFilesExist = false;
  }
  
} catch (error) {
  console.log(`❌ Manifest validation failed: ${error.message}`);
  allFilesExist = false;
}

// Validate JavaScript files for basic syntax
const jsFiles = ['background.js', 'popup.js', 'options.js'];
jsFiles.forEach(file => {
  try {
    const jsPath = path.join(distPath, file);
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Basic syntax check - try to wrap in a function
    new Function(jsContent);
    console.log(`✅ ${file} - syntax OK`);
  } catch (error) {
    console.log(`❌ ${file} - syntax error: ${error.message}`);
    allFilesExist = false;
  }
});

// Check HTML files for basic structure
const htmlFiles = ['popup.html', 'options.html'];
htmlFiles.forEach(file => {
  try {
    const htmlPath = path.join(distPath, file);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    if (htmlContent.includes('<html') && htmlContent.includes('</html>')) {
      console.log(`✅ ${file} - structure OK`);
    } else {
      console.log(`❌ ${file} - invalid HTML structure`);
      allFilesExist = false;
    }
  } catch (error) {
    console.log(`❌ ${file} - read error: ${error.message}`);
    allFilesExist = false;
  }
});

// Final validation result
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 Extension validation PASSED - Ready to load in Chrome!');
  process.exit(0);
} else {
  console.log('❌ Extension validation FAILED - Please fix the issues above');
  process.exit(1);
}
