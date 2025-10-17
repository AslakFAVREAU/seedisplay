/**
 * Génération automatique des icônes d'application
 * Convertit Flavicon.png en .ico (Windows) et .icns (macOS)
 * 
 * Usage: npm run icons
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// Configuration
const CONFIG = {
  sourceImage: path.join(__dirname, '..', 'assets', 'Flavicon.png'),
  outputDir: path.join(__dirname, '..', 'build'),
  tempDir: path.join(__dirname, '..', 'build', 'temp'),
  
  // Tailles requises pour .ico (Windows)
  icoSizes: [16, 24, 32, 48, 64, 128, 256],
  
  // Tailles requises pour .icns (macOS)
  icnsSizes: [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' }
  ]
};

/**
 * Vérifie si l'image source existe
 */
async function checkSourceImage() {
  if (!fs.existsSync(CONFIG.sourceImage)) {
    throw new Error(`Image source introuvable: ${CONFIG.sourceImage}`);
  }
  
  console.log('✅ Image source trouvée:', CONFIG.sourceImage);
  
  // Vérifier les dimensions
  const metadata = await sharp(CONFIG.sourceImage).metadata();
  console.log(`   Dimensions: ${metadata.width}x${metadata.height}px`);
  
  if (metadata.width < 1024 || metadata.height < 1024) {
    console.warn('⚠️  Attention: L\'image source devrait faire au moins 1024x1024px pour une meilleure qualité');
  }
}

/**
 * Crée les répertoires nécessaires
 */
function createDirectories() {
  [CONFIG.outputDir, CONFIG.tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('✅ Répertoire créé:', dir);
    }
  });
}

/**
 * Génère une image PNG redimensionnée
 */
async function generatePNG(size, outputPath) {
  await sharp(CONFIG.sourceImage)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(outputPath);
  
  return outputPath;
}

/**
 * Génère le fichier .ico (Windows)
 * Utilise png-to-ico pour combiner plusieurs tailles en un seul .ico
 */
async function generateICO() {
  console.log('\n🖼️  Génération du fichier .ico (Windows)...');
  
  const pngFiles = [];
  
  // Générer toutes les tailles PNG
  for (const size of CONFIG.icoSizes) {
    const pngPath = path.join(CONFIG.tempDir, `icon_${size}.png`);
    await generatePNG(size, pngPath);
    pngFiles.push(pngPath);
    console.log(`   ✓ ${size}x${size}px`);
  }
  
  // Combiner en .ico
  try {
    const pngToIco = require('png-to-ico');
    const icoPath = path.join(CONFIG.outputDir, 'icon.ico');
    
    const icoBuffer = await pngToIco(pngFiles);
    fs.writeFileSync(icoPath, icoBuffer);
    
    console.log(`✅ Fichier .ico généré: ${icoPath}`);
    console.log(`   Tailles incluses: ${CONFIG.icoSizes.join(', ')}px`);
    
    return icoPath;
  } catch (error) {
    console.error('❌ Erreur lors de la génération du .ico:', error.message);
    throw error;
  }
}

/**
 * Génère le fichier .icns (macOS)
 * Nécessite iconutil (fourni avec Xcode sur macOS)
 */
async function generateICNS() {
  console.log('\n🍎 Génération du fichier .icns (macOS)...');
  
  const iconsetDir = path.join(CONFIG.tempDir, 'icon.iconset');
  
  // Créer le répertoire .iconset
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  fs.mkdirSync(iconsetDir, { recursive: true });
  
  // Générer toutes les tailles requises
  for (const { size, name } of CONFIG.icnsSizes) {
    const pngPath = path.join(iconsetDir, name);
    await generatePNG(size, pngPath);
    console.log(`   ✓ ${name} (${size}x${size}px)`);
  }
  
  // Convertir en .icns avec iconutil (macOS uniquement)
  const icnsPath = path.join(CONFIG.outputDir, 'icon.icns');
  
  if (process.platform === 'darwin') {
    try {
      await exec(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
      console.log(`✅ Fichier .icns généré: ${icnsPath}`);
    } catch (error) {
      console.warn('⚠️  iconutil non disponible (macOS uniquement)');
      console.log('   Le répertoire .iconset a été créé:', iconsetDir);
    }
  } else {
    console.warn('⚠️  Génération .icns disponible uniquement sur macOS');
    console.log('   Les fichiers PNG ont été générés dans:', iconsetDir);
    console.log('   Copiez ce répertoire sur macOS et exécutez:');
    console.log(`   iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
  }
  
  return icnsPath;
}

/**
 * Génère une icône PNG simple (256x256) pour Linux/autres
 */
async function generatePNGIcon() {
  console.log('\n🐧 Génération de l\'icône PNG (256x256)...');
  
  const pngPath = path.join(CONFIG.outputDir, 'icon.png');
  await generatePNG(256, pngPath);
  
  console.log(`✅ Icône PNG générée: ${pngPath}`);
  return pngPath;
}

/**
 * Nettoie les fichiers temporaires
 */
function cleanup() {
  console.log('\n🧹 Nettoyage des fichiers temporaires...');
  
  if (fs.existsSync(CONFIG.tempDir)) {
    fs.rmSync(CONFIG.tempDir, { recursive: true });
    console.log('✅ Fichiers temporaires supprimés');
  }
}

/**
 * Met à jour package.json avec les nouveaux chemins d'icônes
 */
async function updatePackageJson() {
  console.log('\n📦 Mise à jour de package.json...');
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Mettre à jour la configuration build
  if (!packageJson.build) {
    packageJson.build = {};
  }
  
  packageJson.build.icon = 'build/icon.ico';
  packageJson.build.win = packageJson.build.win || {};
  packageJson.build.win.icon = 'build/icon.ico';
  
  packageJson.build.mac = packageJson.build.mac || {};
  packageJson.build.mac.icon = 'build/icon.icns';
  
  packageJson.build.linux = packageJson.build.linux || {};
  packageJson.build.linux.icon = 'build/icon.png';
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json mis à jour avec les chemins d\'icônes');
}

/**
 * Affiche un résumé
 */
function displaySummary() {
  console.log('\n' + '='.repeat(60));
  console.log('🎉 GÉNÉRATION D\'ICÔNES TERMINÉE!');
  console.log('='.repeat(60));
  console.log('\n📁 Fichiers générés dans:', CONFIG.outputDir);
  console.log('   • icon.ico  (Windows - multi-résolutions)');
  console.log('   • icon.icns (macOS - multi-résolutions)');
  console.log('   • icon.png  (Linux/autres - 256x256px)');
  console.log('\n🚀 Prochaines étapes:');
  console.log('   1. Vérifiez les icônes dans le dossier build/');
  console.log('   2. Lancez "npm run dist" pour construire l\'app avec les nouvelles icônes');
  console.log('   3. Les icônes seront automatiquement incluses dans la build');
  console.log('\n💡 Note: Pour .icns sur Windows, copiez build/temp/icon.iconset/');
  console.log('   sur macOS et exécutez: iconutil -c icns icon.iconset -o icon.icns');
  console.log('='.repeat(60) + '\n');
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🎨 GÉNÉRATION AUTOMATIQUE D\'ICÔNES');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Étape 1: Vérifications
    await checkSourceImage();
    
    // Étape 2: Préparation
    createDirectories();
    
    // Étape 3: Génération des icônes
    await generateICO();
    await generateICNS();
    await generatePNGIcon();
    
    // Étape 4: Mise à jour de la configuration
    await updatePackageJson();
    
    // Étape 5: Nettoyage (optionnel, commenter pour garder les fichiers temporaires)
    cleanup();
    
    // Étape 6: Résumé
    displaySummary();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main();
}

module.exports = { generateICO, generateICNS, generatePNGIcon };
