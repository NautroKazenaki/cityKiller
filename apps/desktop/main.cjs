const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: 'City Killer',
    webPreferences: {
      contextIsolation: true
    }
  });
  // Меню прячем насовсем, а не через autoHideMenuBar: тот показывает его по Alt,
  // а Alt в игре — «показать признаки жителей». Горячие клавиши меню работают и так.
  win.setMenuBarVisibility(false);

  // CITYKILLER_DEV_URL=http://localhost:5173 — для разработки с vite dev-сервером
  const devUrl = process.env.CITYKILLER_DEV_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
