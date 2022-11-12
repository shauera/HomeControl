# HomeControl

--- Project setup
In firebase console UI
- Create project "HomeControl"
from url https://github.com/coreybutler/nvm-windows
- install nvm for windows
in power shell run
- nvm list available
- nvm intall 16.18.1 (or the lates version supported by firebase)
- nvm use 16.18.1
- npm install firebase-functions@latest firebase-admin@latest --save
- npm install -g firebase-tools
from the vscode terminal on the project folder - intialize project
- firebase login
- firebase init firestore (it will fail and require db creation from the ui. go to the project setting and set "Default GCP resource location". afetr that run the command again. it creates two files for firestore)
- firebase init functions (this creates a project skeleton with all basic firebase files)
-> index.js - main code file
-> package.json - npm package file describing the Cloud Functions code
- add some functions to index.js

--- run emulator
- firebase emulators:start
- Once the emulator is started the functions with their URLs can be found at the Emulator UI link

--- deploy functions
- enable billing on the project through the ui
- had to change `"lint": "eslint ."` to `"lint": "eslint"` in package.json for linting to work
- firebase deploy --only functions (for every function that can be invoked by URL te CLI will return its URL)
