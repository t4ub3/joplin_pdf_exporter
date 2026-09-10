# PDF Exporter

This is a plugin for [Joplin](https://joplinapp.org/), an open source note-taking app. With this plugin, you can:

- export a note to pdf
- insert manual page breaks
- set paper format, margins, automatic page breaks
- create header and footer (manually and with placeholders)

## installation

0. install Joplin
1. download the .jpl-file from `joplin_pdf_exporter/publish`
2. In the joplin App, go to `tools/options/plugins`
3. click the gear icon next to "manage your plugins" and select `install from file`
4. choose the downloaded .jpl-file
5. restart joplin, the plugin should be listed on `tools/options/plugins`

## how to use

##### add page breaks

add `///pagebreak` anywhere in your document to add a manual page break.

##### export pdf

Click the pdf icon on the toolbar to open the PDF Exporters side panel. Set the values as you like and click `Export PDF ...` button.

![Usage screenshot](/src/assets/pdf-exporter-usage.png)
