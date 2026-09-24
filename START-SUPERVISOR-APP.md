# Start InfraSync Supervisor Without VS Code

## One-click launch

Double-click `run-supervisor-mobile.command` in Finder. The launcher will:

1. Start the Next.js backend on this Mac's Wi-Fi address.
2. List the Flutter devices connected to the Mac.
3. Ask for the phone device ID.
4. Launch the supervisor app with the correct backend URL and local API key.

The backend log is saved at:

```text
~/Library/Logs/InfraSync/backend.log
```

## Use from a phone without Android Studio

Double-click `~/Desktop/InfraSync Supervisor Phone.command`. It starts the
backend and Flutter web app, then prints and opens a phone URL such as
`http://10.25.45.50:8080`.

Open that URL on the phone while the phone and Mac are on the same Wi-Fi. Save
it as a browser bookmark or add it to the phone home screen. You can close and
reopen the browser app normally. The Mac must remain powered on, awake, and
connected to the same Wi-Fi; starting the launcher again restarts the services
after the Mac has been rebooted.

This is the Flutter app running in the phone browser. Android Studio is only
needed for installing a native Android APK.

## Phone preparation

- Put the phone and Mac on the same Wi-Fi network.
- Android: enable Developer options and USB debugging, then connect by USB.
- iPhone: trust the Mac and configure the device for development in Xcode.
- Keep the phone unlocked while Flutter installs the debug app.

The launcher automatically detects the Mac's current Wi-Fi IP, so it keeps working when the network address changes.

## Manual launch

From Terminal:

```bash
cd "/Users/moulikkohli/Downloads/infrasync-ai APP/infrasync-ai"
./run-supervisor-mobile.command
```

For Chrome, enter `chrome` when prompted. For a physical phone, enter the ID shown by `flutter devices`.

## Health checks

```bash
cd "/Users/moulikkohli/Downloads/infrasync-ai APP/infrasync-ai"
npm run build

cd mobile
$HOME/development/flutter/bin/flutter analyze
$HOME/development/flutter/bin/flutter test
```

All three checks currently pass.
