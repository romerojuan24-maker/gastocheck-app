#!/usr/bin/env node

/**
 * Script para hacer login automático en CheckSuite
 * Simula las acciones del usuario
 */

const puppeteer = require('puppeteer');

async function autoLogin() {
  let browser;
  try {
    console.log('🚀 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    console.log('📱 Navegando a http://localhost:3000/login');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

    // Esperar a que cargue el formulario
    console.log('⏳ Esperando formulario...');
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    // Llenar email
    console.log('📧 Ingresando email: demo@gastocheck.app');
    await page.type('input[type="email"]', 'demo@gastocheck.app', { delay: 50 });

    // Llenar contraseña
    console.log('🔐 Ingresando contraseña...');
    await page.type('input[type="password"]', 'DemoGastoCheck2026!', { delay: 50 });

    // Click en botón Entrar
    console.log('✅ Haciendo click en botón Entrar...');
    await page.click('button:contains("Entrar")');

    // Esperar a que navegue
    console.log('⏳ Esperando a que inicie sesión...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });

    console.log('🎉 ¡Sesión iniciada correctamente!');
    console.log('📍 URL actual:', page.url());

    // Esperar a que el usuario vea la pantalla
    console.log('\n✨ El navegador se cerrará en 60 segundos...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

autoLogin();
