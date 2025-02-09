fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use --install-if-missing 20
pbiviz start