# BV Mudrana

A PageMaker-style layout program for Windows, built for books in Kannada, Devanagari and IAST, using real Unicode and proper shaping (ottus, vattaksharas, conjuncts, diacritics).

## Install

**First time:** run **BV Mudrana Setup <version>.exe**.

**Every later version:** run **BV Mudrana Update <version>.exe** (about 8 MB). It finds the installed BV Mudrana, closes it if it is open, puts the new version in place and opens it again. There is no need to uninstall or reinstall: settings, recent files, autosaves, shortcuts and file associations stay as they are. Each update carries the whole current program, so it works from any earlier version, even if you skipped some. (Running a newer full Setup over the installed one also works and keeps your settings.)


The installer and the update aren't signed yet, so Windows may show "Windows protected your PC". Click **More info → Run anyway**.

## New in 0.9.2

- PageMaker text blocks start exactly where they did (per-block character counts, records 0x1B) and are threaded in PageMaker's order.
- Tab stops read from PageMaker (records 0x0C); right/centre tabs align the whole run to the next tab.
- PageMaker 5 line end points read from +0x28.
- Auto hyphenation (Liang, US English) for paragraphs that PageMaker hyphenated; justified lines may squeeze word spaces to the minimum from the paragraph record.
- BV Matanga bundled; all bundled fonts installed per user in Windows (Utilities > Install Brahmavidya Fonts in Windows).

## New in 0.9.1

- PageMaker 5 (.pm5) files are read directly (same table of contents as PageMaker 6, smaller records): pages, threaded text in reading order, master items, lines and boxes.
- Nalanda accents are dead keys (typed before the letter); they now combine with the right letter.
- Text blocks shorter than one line (running heads) are given one line.

## New in 0.9

- **Tabs**: every publication opens in its own tab; File > Open can pick several files. Ctrl+Tab / Ctrl+Shift+Tab switch, Ctrl+W closes, Ctrl+Shift+T reopens the last closed one. Tabs can be dragged; the Window menu lists them.
- **Start screen**: Indian book sizes (Demy, Crown, Royal) and A4/A5/Letter in one click; recent files with pictures of their first page; filter; grid or list.
- **InDesign**: IDML (CS4 to 2026) opens directly: pages, masters, layers, colours, paragraph and character styles, threaded frames, shapes, groups, rotation, linked or embedded pictures with their crop. INDD, INDT and INX open through an installed InDesign (driven over COM in the background). Save As / Export writes IDML (pictures go to a "<name> Links" folder) and, with InDesign installed, INDD or INDT. Indic paragraphs use the Adobe World-Ready composer.
- **PageMaker 4 and 5** (.pm5, .pm4) open through PageMaker 7 on the same computer, which converts them.
- **Chanakya, Chanakyamath, Walkman-Chanakya-901 and Nalanda** text becomes Unicode in BV Chitkala, BV Chitkala Math, BV Chitkala Hindi and BV Nanda (bundled), when opening PageMaker files, placing Word/RTF files, and with Utilities > Convert Legacy Text to Unicode. Saving back to PageMaker turns it back into the old encoding.
- **Pictures from PageMaker** that sit on text get text wrap, as in PageMaker (option in the Open dialog).
- **Smart Guides** (View menu), **typographer's quotes** (Type menu), live **word count** and **preflight light** in the status bar.

## New in 0.8

- **PageMaker pictures:** cropped pictures now show exactly the part that was visible in PageMaker, at the right size and place. Before, the whole picture was squeezed into the cropped frame, which pushed things out of shape.
- **Reflow overset text:** Layout > Reflow Overset Text adds pages with threaded text blocks (in the page's columns) until every story fits, after the story's last page or at the end. The Open dialog for PageMaker files has the same option, and the "is open" message offers it when text still runs over. Layout > Smart Text Reflow adds pages at the end while you type (InDesign).
- **Find and Change** finds across formatting changes, with Match case, Whole word (also for Kannada and Devanagari), Regular expressions with $1, Change, Change All and Count.
- **Find Font** (Utilities): every font in the publication, replaced everywhere in one go.
- **Format Painter** (Edit > Copy Formatting / Paste Formatting / Format Painter, Ctrl+Alt+Shift+C / V).
- **Insert Special Character, White Space and Field** (Type menu): danda, double danda, avagraha, Om, ZWNJ, ZWJ, rupee, quotes, spaces; date, time, publication name, number of pages, your name.
- **Watermark and Page Border** (Layout), in print and PDF.
- **Fit Frame to Text** (Element, Ctrl+Alt+C), **Show Text Threads** (View), **Sticky Notes** that never print and **Read Aloud** (Utilities).
- **Your name:** the setup asks for it. The welcome screen says Namaste and the title bar shows "<name>'s Mudrana | document". Change it in File > Preferences > Your Name.
- **What's New:** a link on the welcome screen (and Help > What's New) lists the new features; it also opens once after each update.
- The title bar carries the mark "Designed by Tejas H Badala for BV".

## New in 0.7.3: Praja Unicode kit 1.11

- **Praja Unicode fonts 1.110** from the kit: shaping done by the font itself (works the same in Word, LibreOffice and browsers), ottaksharas that follow each other no longer overlap, ು before the ottakshara as Nudi types it.
- **Praja01 to Praja08** (kit ASCII fonts 1.210, the Praja design on the Nudi ASCII layout) are now built in and understood: text in them is read as Nudi, converts with the Brahmavidya converter, and goes to the matching Praja Unicode face (01/02 Light, 03/04 Regular and Italic, 05/06 Demi, 07/08 Bold) on opening PageMaker files, placing Word or RTF files, and converting documents. Saving back to PageMaker puts it back in its Praja01 to Praja08 font.
- The converter is the kit 1.11 version (ು hook placed before the ottakshara when turning Unicode back into Praja).
- ಈ has its lower bowl open in every face of both sets (the kit's Regular, Italic, Bold and Bold Italic still drew it solid). `tools/fix_praja_ee.py` now finds the letter by itself in any Praja font, Unicode or Nudi layout, and leaves faces that are already open alone.
- Utilities > Kannada > Install the Praja Fonts shows all 16 fonts, with the steps for Word.

## New in 0.7.2

- Updates: from now on each version also comes as a small **BV Mudrana Update** file that installs on top of the installed BV Mudrana.

## New in 0.7.1

- Praja Unicode Regular, Italic, Bold and Bold Italic: the lower bowl of ಈ is now open, as in Demi and Light (the original fonts drew it solid, which looked like shading). `tools/fix_praja_ee.py` makes the same change to fonts built with the Praja Unicode kit.

## New in 0.7: Praja (Prajavani) fonts

BV Mudrana now knows the Praja fonts (Praja, Praja_Demi, Praja_Light and their bold and italic styles) as their own layout, separate from Nudi. It uses the Brahmavidya Praja Unicode converter and bundles the eight **Praja Unicode** fonts (same Praja letters and widths, as Unicode Kannada).

- **Opening PageMaker files:** text in Praja fonts gets its own row in the Open dialog with three choices: Unicode in Praja Unicode (recommended: same look, same line breaks, 100%), Unicode in another font such as a Nudi Unicode font (size measured on your text so line lengths stay the same), or keep as Praja ASCII.
- **Utilities > Kannada > Kannada ASCII (Praja) → Unicode…** converts the selected text, the selected stories or the whole publication, to Praja Unicode or another font, keeping bold, italic, size, colour and every other setting. Syllables split by a formatting change are kept whole. Paragraph styles that use Praja fonts can be changed too.
- **Kannada Unicode → ASCII (Praja)** turns Unicode back into Praja ASCII for old workflows.
- **Convert a Praja or Nudi Document (Word, RTF, Text)…** converts a .docx, .rtf or .txt file in place and saves a copy. In Word documents only the Praja or Nudi runs change; the complex-script font, bold, italic and size Word needs for Kannada are set on each converted run, and styles that used Praja are updated.
- **Place** of Word and RTF files sees Praja and Nudi fonts and offers the same choices. Text files can be placed as Praja or Nudi ASCII. Paste Special has a Praja option.
- **Saving back to PageMaker:** text that came from Praja goes back to Praja ASCII in its Praja font. Naming a Praja font in the Save dialog sends new Kannada text to Praja too.
- **Install the Praja Unicode Fonts…** opens the folder with the eight fonts so they can be installed in Windows for Word and other programs.
- The Word style ribbon has a Praja group on the Language tab.

## New in 0.6: interface modes and themes

Choose them from Window > Interface Mode, View > Interface Theme, the Workspace buttons on the Welcome screen, or the chip at the bottom right of the window. View > Interface Theme > Appearance Settings shows them all side by side.

Interface modes:
- **PageMaker**: the classic PageMaker 7 layout: toolbox, control palette, styles, colours, layers and masters.
- **Advanced**: everything at once (pages panel and Align palette too) with tighter spacing, for big books.
- **Word style**: a Microsoft Word style ribbon with File, Home, Insert, Layout, Language, Review and View tabs. Home has the font, size, bold, alignment and a live styles gallery. Language has the Kannada keyboards, transliteration and Nudi conversion. Save, Undo and Redo sit in the title bar, and "Tell me what you want to do" finds any command. Double-click a tab or press Ctrl+F1 to fold the ribbon away.
- **Basic**: one row of big, labelled buttons (New, Open, Save, Undo, Text box, Picture, Shape, font and size, Kannada keyboard, PDF, Print, Help). No palettes, no rulers. All the menus are still under the Menus button.

Themes: Studio Dark, Paper Light, Material You and Material You Dark (Pixel style, coloured from a seed colour you pick), Classic PageMaker 7 (grey Windows 2000 look with navy title bars, white pasteboard and black page shadow), Modern Expressive (bold colour and glass panels) and Generic (plain Windows look).

Also: Help > Quick Start walks a new user through the first page, with steps that match the chosen mode. Word and Basic modes have a zoom slider in the status bar. Hiding the rulers no longer hides the page.

## New in 0.5

- Smart open for PageMaker files (any version). After you pick a .pmd, .p65 or .pm6 file, BV Mudrana surveys every font in the file and recommends what to do with each one: convert Nudi/Baraha Kannada to a Unicode font, or keep it as ASCII, and which installed font to use. It measures your Nudi text against the Unicode text and suggests a size so line breaks stay the same (or letter height stays the same, your choice). Missing Latin fonts get a close substitute. Overset stories can be fitted automatically.
- More PageMaker formatting is kept on open: outline, shadow, reverse, set width, tracking, baseline shift, superscript, subscript, small caps.
- Kannada keyboards built in: KGP (Nudi style) and phonetic Kannada, plus phonetic Devanagari and IAST. Toggle with Scroll Lock or Ctrl+Alt+K, or click the keyboard chip in the status bar.
- Footnotes (Type > Insert Footnote, Ctrl+Alt+Shift+N). Numbers update by themselves and use Kannada or Devanagari digits if you like. Notes sit at the foot of the frame and push text on when space runs out.
- Numbering and Sections (Layout menu): roman front matter, restart numbers, prefixes.
- Find a Command (Ctrl+Enter, or the search box in the title bar): type any menu item, style, master page or page number.
- Autosave every two minutes and File > Recover Unsaved Work.
- Preview mode (Ctrl+Alt+Shift+W) hides guides and frame edges.
- Utilities > Clean Up Text: double spaces, space before punctuation, empty paragraphs, smart quotes, stray ZWJ/ZWNJ, danda spacing.
- Overset indicator in the status bar; click it to jump to the overset story.
- Em dashes removed from all menus, dialogs and help text.

## New in 0.4.2

- Fixed: the PageMaker helper used a .NET function that Windows' .NET Framework 4 does not have (“Method not found: String.Split”). It is now built against .NET Framework 4.0 itself, and if it ever fails, BV Mudrana retries through Windows PowerShell.

## New in 0.4.1, saving to PageMaker fixed

- The commands sent to PageMaker 7 were garbled on the way (they were sent in the wrong character encoding), so PageMaker ignored them and nothing was saved. A small helper program (`pmdde.exe`) now drives PageMaker and sends them correctly; this was tested end to end against a stand-in PageMaker DDE server.
- Text is placed as normal PageMaker text blocks, threaded with Place Next, no frame IDs needed.
- If PageMaker 7 is not found, BV Mudrana asks you to point to **Pm70.exe** (and remembers it) instead of quietly writing a kit.
- After saving you get a clear “Saved” or “Not saved” message; when something goes wrong, a *PageMaker log.txt* records exactly what PageMaker answered.

## New in 0.4

- **New look**: a quiet dark studio interface in Brahmavidya saffron (View ▸ Interface Theme ▸ Light for a warm paper look), the Brahmavidya logo on the welcome screen, title bar and app icon.
- **PageMaker's menus drawn inside the window** (no more browser-style menu bar): same File / Edit / Layout / Type / Element / Utilities / View / Window / Help menus, submenus, Alt access keys, shortcut hints, and tooltips that show the shortcut.
- From Scribus: **Pages** and **Outline** palette (drag to reorder pages, see every object), **Align & Distribute** palette, **Glyphs** palette (Kannada, Devanagari, Vedic signs, IAST, spaces and joiners), **tables**, **character styles**, **gradient fills and transparency** with blend modes, **PDF export with bleed and printer's marks**, **baseline grid**, **sample text** (Kannada, Sanskrit, IAST, Latin), **ISBN/EAN-13 barcode**, fit picture to frame / frame to picture, duplicate, eyedropper colour, document information.

## New in 0.3

- **Save As PageMaker**: .pmd, .pm7, .p65 (PageMaker 6.5) and .pmt (template), besides .bvm. PageMaker 7 on the same computer builds the publication (driven over DDE); without it, a *PageMaker kit* folder is written whose script builds the publication in PageMaker 7. Unicode Kannada is converted to Nudi ASCII with the Brahmavidya converter.
- **Brahmavidya Kannada converter** for every conversion (Nudi ↔ Unicode), with visible halants (ಷಟ್‌ಶ್ರುತಿ) kept.
- Opening PageMaker files: choose **Convert to Unicode** or **Keep the ASCII text in its Nudi font**. A missing Nudi font is drawn with another installed Nudi font.
- All system fonts, read straight from the font files; the font list in dialogs works.
- Scroll bars, a large pasteboard, wheel/keyboard zooming with Ctrl, Alt and Shift (Help ▸ Keyboard Shortcuts), moveable zero point.
- PageMaker 7 features: named master pages (new, duplicate, delete, apply, save page as master), full Character and Paragraph Specifications (tint, reverse, outline, shadow, small caps, keep together / with next, widow and orphan control, column and page breaks, include in TOC), paragraph rules, drop caps, kerning keys and Expert Kerning, discretionary hyphens, compound strokes, masks, image control, links manager, next/previous frame, remove from threads, Story menu.
- Plug-ins: Balance Columns, Build Booklet, Bullets and Numbering (also Kannada and Devanagari numerals), Change Case, Continuation, Drop Cap, Grid Manager, Keyline, Running Headers/Footers, Sort Pages, Word Counter, Data Merge, Save for Service Provider, Library, Hyperlinks.
- Utilities: Book (export the whole book as one PDF), Index Entry / Show Index / Create Index, Spelling (English), Define Colors, Preflight. Export HTML, graphics (PNG/JPEG/SVG) and PageMaker Tagged Text.

## New in 0.2

- **Opens PageMaker 6.5 and 7 files** (.p65, .pmd, .pm6): pages, master pages with running heads and page numbers, threaded text blocks, paragraph and character formatting, colours, lines, boxes, polygons and embedded TIFF/JPEG pictures
- **Nudi → Unicode**: Kannada typed in any Nudi font (01 k, 01 e, 11 k, Akshar …) or Praja is converted to proper Unicode Kannada on opening; Utilities ▸ Plug-ins ▸ Convert Nudi Text does the same for pasted text
- **PageMaker 7 interface**: same menus (File, Edit, Layout, Type, Element, Utilities, View, Window, Help), toolbar, floating 14-tool toolbox, control palette (character / paragraph / object views with reference-point proxy), Styles/Colors and Layers/Master Pages palettes
- **All PageMaker tools**: pointer, text, rotate, crop, line, constrained line, rectangle, rectangle frame, ellipse, ellipse frame, polygon, polygon frame, hand, zoom
- Text wrap, group/ungroup, lock, align objects, layers, colours with tints, rounded corners, polygon settings, frames, reflect, non-printing objects, paste multiple
- Type: tracking, set width, all caps, strikethru, superscript/subscript, baseline shift, indents and tab stops, create table of contents
- Every font installed on the computer is listed in a font picker that shows each font
- Welcome screen at startup with New / Open / recent publications; real printing (Ctrl+P)

## What works in this version

**PageMaker habits**
- One spread at a time, page icons at the bottom (L R for master pages), pasteboard, rulers, drag-out ruler guides
- Toolbox: pointer, text, line, rectangle, ellipse, hand, zoom (F9 switches pointer/text)
- Text blocks with **windowshades**: + means more text, red ▼ means text left over. Click it to get the loaded text icon
- Loaded text: **click** places one column, **Shift-click** semi-autoflow, **Ctrl-click** autoflow (adds pages as needed). Layout → Autoflow turns it on permanently
- **Story Editor** (Ctrl+E) with style names down the left
- Master pages with running heads and the page-number marker (Ctrl+Alt+P), shown as LM/RM on masters
- Styles palette, control palette, Type Specs (Ctrl+T), Paragraph (Ctrl+M), Define Styles (Ctrl+3)
- Place (Ctrl+D): .txt, .md, Word .docx (headings, bold, italic kept), and images
- Document Setup with Indian book sizes (Demy, Crown, Royal), facing pages, columns, page numbers in 1 2 3 / ೧ ೨ ೩ / १ २ ३ / i ii iii
- Insert/remove pages, go to page, find and change, undo/redo, bring to front/send to back
- Export PDF (Ctrl+P): vector text, fonts embedded, exactly as on screen

**For Sanskrit and Kannada books**
- Transliterate a selection: Ctrl+Alt+1 Devanagari, Ctrl+Alt+2 Kannada, Ctrl+Alt+3 IAST; also ITRANS and Harvard-Kyoto input
- Utilities → Duplicate as Transliteration: puts an IAST (or Kannada) line under every śloka
- IAST characters palette (Ctrl+Alt+I)
- Ready styles: Body text, Chapter title, Heading 2, Shloka, Shloka (Kannada), IAST, Translation, Footnote, Running head
- Headings and ślokas stay with the text that follows; no lone first lines at the bottom of a page
- Bundled free fonts (Noto Serif/Sans Kannada and Devanagari, Noto Serif for IAST). Any font installed on Windows also shows in the font list, including your own

## Run from source (for development)

```
npm install
npm start          # run the app
npm run dist       # build the Windows installer into dist/
```

## Not yet (next steps)

- BRH Devanagari (Baraha) and Shree-Lipi conversion (text is kept in its legacy font for now)
- Book, index, spelling, hyphenation
- Tables, inline graphics, saving back to PageMaker format
- Editable keyboard shortcuts
