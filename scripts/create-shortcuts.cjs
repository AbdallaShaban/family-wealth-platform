const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targets = [
  {
    lnk: 'C:\\Users\\abdal\\OneDrive\\سطح المكتب\\منصة العائلة المالية.lnk',
    vbs: 'C:\\Users\\abdal\\OneDrive\\سطح المكتب\\تشغيل منصة العائلة.vbs'
  },
  {
    lnk: 'C:\\Users\\abdal\\Desktop\\منصة العائلة المالية.lnk',
    vbs: 'C:\\Users\\abdal\\Desktop\\تشغيل منصة العائلة.vbs'
  }
];

const scriptDir = 'D:\\نسخ احتياطى\\5\\family-wealth-assessment-live';

targets.forEach(t => {
  const dir = path.dirname(t.lnk);
  if (fs.existsSync(dir)) {
    const psScript = `
      $WshShell = New-Object -ComObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut('${t.lnk}')
      $Shortcut.TargetPath = '${t.vbs}'
      $Shortcut.WorkingDirectory = '${scriptDir}'
      $Shortcut.Description = 'تشغيل منصة إدارة ثروة العائلة في الخلفية'
      $Shortcut.Save()
    `;
    const tempPs = path.join(scriptDir, 'scripts', 'temp_create_shortcut.ps1');
    fs.writeFileSync(tempPs, psScript, 'utf8');
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs}"`);
      console.log('Shortcut created successfully:', t.lnk);
    } finally {
      if (fs.existsSync(tempPs)) fs.unlinkSync(tempPs);
    }
  }
});
