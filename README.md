# What is this?

It's a simple quick and dirty experiment that you can fork as you wish.
It was created with direct mode in mind, because as of today in 2025-02-09:
- Opening the default hierarchy slicer in direct mode sends one query per level to the backend DB
- Ragged hierarchies are not nicely handled (null / repeated nodes are not hidden)
- I don't need backend calls when the entire hierarchy can be handled on the client side and wish to have some flexibility to decide when to fetch data (max number of rows, level depth,..)

It uses the open source React Library https://mui.com/

As of 2025-02-09, it tries to resolve all the hierarchy level into a single unique key available

# Setup your env

```powershell
winget install Schniz.fnm
# RESTART your VSCode instance
# if fnm is still not recognized, go to your Windows environment variables and copy the 'Path' User variables refering to winget (should be the last added) and add it to the 'Path' System variables and click OK 3 times then restart VSCode again
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use --install-if-missing 20
# verifies the right Node.js version is in the environment
node -v # should print `v20.17.0`
# verifies the right npm version is in the environment
npm -v # should print `10.8.2`
npm install
```
How to launch this visual?
```powershell
pbiviz start
```