# HomeControl

--- Project setup - firebase
In firebase console UI
- Create project "HomeControl"
- from the API and services enable the HomeGraph API for the project. This component keeps the state of devices
- create a service account `HomeControl Home Graph API` with role `service Acoount Token Creator` to be used by the app to invoke Home Graph APIs
- create a key for the service account. save the key in the `smart-home-key.json` file
- Create Realtime Database by running `firebase init database` (this is needed in the app and referenced by firebaseRef)
from url https://github.com/coreybutler/nvm-windows
- install nvm for windows
in power shell run
- nvm list available
- nvm intall 16.18.1 (or the lates version supported by firebase)
- nvm use 16.18.1
- npm install firebase-functions@latest firebase-admin@latest --save
- npm install @google-cloud/pubsub@latest --save
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

--- Project setup - pubsub
In pubsub console UI
- in project "HomeControl" create topic "ControlCommands"
In IAM & Admin UI
- Create service account "HomeControlCommandPublisher"
- Create service account "HomeControlCommandSubscriber"
- create a service key for service HomeControlCommandSubscriber. It will be used by the raspbery pi
In pubsub console UI
- select the "ControlCommands" topic add "pub/sub publisher" role to the "HomeControlCommandPublisher" service
- attach the service account to the publisher function from "runtime" paramets in the cloud functions UI
- select the "ControlCommands" subsciption add "pub/sub subscriber" role to the "HomeControlCommandSubscriber" service

--- project setup - google actions
in actions UI
- add the "HomeControl" project
- Select "smart home" action type to build
- name the smart home action "Home Control"
- To enable Account linking (must happen!), select the Develop > Account linking option in the left navigation. Use these account linking settings:   
    ```   
    Client ID               : ABC123   
    Client secret           : DEF456
    Authorization URL       : https://us-central1-<project-id>.cloudfunctions.net/fakeauth  
    Token URL               : https://us-central1-<project-id>.cloudfunctions.net/faketoken  
in VScode add mandatory functions to index.js in order to fullfil the action
- npm install actions-on-google --save-prod
- The fullfilment is exposed through the `smarthome` function. The function link must be pasted in the fullfilment url

Note: for the `firestore database` I had to create a key to the `Firebase admin sdk` service account and load that key into the `admin.initializeApp`. That gives the functions access to te database.
