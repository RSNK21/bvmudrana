/* BV Mudrana: legacy Devanagari and IAST fonts to Unicode, and back.
   Chanakya, Chanakyamath and Walkman-Chanakya-901 (Devanagari) become Unicode Devanagari set in BV Chitkala,
   BV Chitkala Math and BV Chitkala Hindi. Nalanda fonts (IAST transliteration) become Unicode Latin set in
   BV Nanda. The tables come from the fonts themselves: each legacy glyph was matched outline for outline
   with its glyph in the BV fonts, which were made from them. */
(function () {
  const BV = (window.BV = window.BV || {});
  // code -> [kind, text]. Kinds: C consonant or conjunct, H half form (ends in virama), V vowel sign,
  // M other mark (nukta, anusvara, rakar, yaphala...), P i-sign written before its consonant (text = what
  // follows the i-sign, like an anusvara), PR i-sign with a reph, R reph (text = what follows it), X anything else.
  const T = {"chanakya":{"16":["X","\u090d"],"18":["X","\u0911"],"22":["V","\u093e"],"24":["X","\u0914"],"25":["V","\u0949"],"33":["X","!"],"34":["X","\u5350"],"35":["C","\u092a\u094d\u0924"],"36":["X","."],"37":["C","\u0924\u094d\u0928"],"38":["X","\u00d7"],"39":["X","%"],"40":["X","("],"41":["X",")"],"42":["X","*"],"43":["X","+"],"44":["X",","],"45":["X","-"],"46":["X","."],"47":["X","/"],"48":["X","\u0966"],"49":["X","\u0967"],"50":["X","\u0968"],"51":["X","\u0969"],"52":["X","\u096a"],"53":["X","\u096b"],"54":["X","\u096c"],"55":["X","\u096d"],"56":["X","\u096e"],"57":["X","\u096f"],"58":["X",":"],"59":["X",";"],"60":["X","<"],"61":["X","="],"62":["X",">"],"63":["X","?"],"64":["C","\u091e\u094d\u091a"],"65":["M","\u094d\u0930"],"66":["C","\u0915\u094d\u091a"],"67":["C","\u0937\u094d\u091f"],"68":["C","\u0937\u094d\u0920"],"69":["C","\u0936\u094d\u0935"],"70":["C","\u0938\u094d\u0928"],"71":["C","\u0924\u094d\u0930"],"72":["X","\u0965"],"73":["C","\u0922\u094d\u0922"],"74":["C","\u091b\u094d\u0935"],"75":["M","\u094d\u092f"],"76":["C","\u0930\u0941"],"77":["C","\u0930\u0942"],"78":["C","\u0939\u0943"],"79":["C","\u0939\u094d\u0930"],"80":["C","\u0915\u094d\u0915"],"81":["C","\u0915\u094d\u0924"],"82":["C","\u0915\u094d\u0930"],"83":["H","\u0938\u094d"],"84":["C","\u091e\u094d\u091c"],"85":["X","\u2009"],"86":["C","\u0919\u094d\u0915"],"87":["C","\u0919\u094d\u0916"],"88":["C","\u0919\u094d\u0917"],"89":["C","\u0919\u094d\u0918"],"90":["R","\u0902"],"91":["X","["],"92":["C","\u091d\u094d\u0930"],"93":["X","]"],"94":["C","\u091f\u094d\u091f"],"95":["C","\u091f\u094d\u0920"],"96":["C","\u0915\u094d\u0935"],"97":["C","\u0921\u094d\u0921"],"98":["C","\u0921\u094d\u0922"],"99":["H","\u0937\u094d"],"100":["C","\u0938\u094d\u0930"],"101":["C","\u0926\u094d\u0917"],"102":["C","\u0926\u094d\u0918"],"103":["C","\u0926\u094d\u0926"],"104":["C","\u0926\u094d\u0927"],"105":["C","\u0926\u094d\u092c"],"106":["C","\u0926\u094d\u092d"],"107":["C","\u0926\u094d\u092e"],"108":["C","\u0926\u094d\u092f"],"109":["C","\u0926\u094d\u0935"],"110":["C","\u0920\u094d\u0920"],"111":["C","\u0936"],"112":["C","\u0936\u094d\u091a"],"113":["C","\u0939\u094d\u0928"],"114":["H","\u0939\u094d\u092e\u094d"],"115":["C","\u0939\u094d\u092f"],"116":["C","\u0939\u094d\u0932"],"117":["C","\u0939\u094d\u0935"],"118":["X","1"],"119":["X","2"],"120":["X","3"],"121":["X","4"],"122":["X","5"],"123":["X","6"],"124":["X","7"],"125":["X","8"],"126":["X","9"],"127":["M","\u0953"],"128":["H","\u0915\u094d"],"129":["H","\u0916\u094d"],"130":["H","\u0917\u094d"],"131":["H","\u0918\u094d"],"132":["C","\u0932\u094d\u0932"],"133":["H","\u091c\u094d"],"134":["H","\u091e\u094d"],"135":["H","\u0923\u094d"],"136":["H","\u0924\u094d"],"137":["H","\u0925\u094d"],"138":["H","\u0927\u094d"],"139":["H","\u0928\u094d"],"140":["H","\u092a\u094d"],"141":["H","\u092b\u094d"],"142":["H","\u092c\u094d"],"143":["H","\u092d\u094d"],"144":["H","\u092e\u094d"],"145":["H","\u091a\u094d"],"146":["H","\u091c\u094d"],"147":["H","\u091a\u094d\u091a\u094d"],"148":["H","\u091c\u094d\u091c\u094d"],"149":["H","\u091c\u093c\u094d"],"150":["C","\u0919\u094d\u0915\u094d\u0937"],"151":["X","\u2014"],"152":["H","\u0924\u094d\u0930\u094d"],"153":["H","\u091c\u094d\u091e\u094d"],"154":["M","\u0901"],"155":["V","\u0944"],"156":["X","\u0950"],"157":["C","\u0938\u094d\u0924\u094d\u0930"],"158":["H","\u0924\u094d\u0924\u094d"],"159":["H","\u0936\u094d\u0930\u094d"],"160":["M","\u0952"],"161":["M","\u0901"],"162":["M","\u0902"],"163":["V","\u0962"],"164":["X","\u2009"],"165":["X","\u0905"],"166":["C","\u0937\u094d\u091f\u094d\u0935"],"167":["X","\u0907"],"168":["P","\u0902"],"169":["X","\u0909"],"170":["X","\u090a"],"171":["X","\u090b"],"172":["X","\u0960"],"173":["X","\u090c"],"174":["X","0"],"175":["C","\u0916\u094d\u0928"],"176":["X","\u090f"],"177":["H","\u0939\u094d"],"178":["C","\u091f"],"179":["H","\u0936\u094d"],"180":["M","\u0902"],"181":["C","\u0926\u094d\u092c\u094d\u0930"],"182":["C","\u0932"],"183":["C","\u0915"],"184":["M","\u093c"],"185":["C","\u0916"],"186":["C","\u0916\u094d\u0930"],"187":["C","\u0917"],"188":["C","\u0926"],"189":["C","\u0921\u094d\u0921"],"190":["C","\u0919"],"191":["C","\u091a"],"192":["C","\u091b"],"193":["C","\u091c"],"194":["C","\u092a"],"195":["H","\u0935\u094d"],"196":["H","\u092f\u094d"],"197":["C","\u091f"],"198":["C","\u0920"],"199":["C","\u0921"],"200":["C","\u092b"],"201":["C","\u0922"],"202":["H","\u091c\u093c\u094d"],"203":["H","\u0932\u094d"],"204":["C","\u0924"],"205":["C","\u0925"],"206":["C","\u0926"],"207":["C","\u0927"],"208":["X","\u0964"],"209":["M","\u0903"],"210":["X","\u2018"],"211":["X","\u2019"],"212":["V","\u0947"],"213":["C","\u092c"],"214":["C","\u092d"],"215":["C","\u092e"],"216":["C","\u092f"],"217":["C","\u0928"],"218":["C","\u0930"],"219":["H","\u091d\u094d"],"220":["C","\u0932"],"221":["C","\u0933"],"222":["M","\u0951"],"223":["C","\u0935"],"224":["H","\u0936\u094d"],"225":["C","\u0937"],"226":["C","\u0938"],"227":["C","\u0939"],"228":["V","\u0941"],"229":["V","\u0942"],"230":["V","\u093e"],"231":["P",""],"232":["V","\u0940"],"233":["V","\u0941"],"234":["V","\u0942"],"235":["V","\u0943"],"236":["P","\u0902"],"237":["PR",""],"238":["M","\u0954"],"239":["X","\u200b"],"240":["V","\u0947"],"241":["V","\u0948"],"242":["V","\u0945"],"243":["H","\u0928\u094d\u0928\u094d"],"244":["V","\u094b"],"245":["V","\u094c"],"246":["C","\u0939\u0941"],"247":["M","\u094d"],"248":["X","\u0970"],"249":["X","\u093d"],"250":["X","\u0950"],"251":["C","\u0933"],"252":["R",""],"253":["M","\u094d\u0930"],"254":["M","\u094d\u0930"],"255":["H","\u0915\u094d\u0937\u094d"]},"chanakyamath":{"16":["X","\u090d"],"18":["X","\u0911"],"22":["V","\u093e"],"24":["X","\u0914"],"25":["V","\u0949"],"33":["X","!"],"34":["X","\u5350"],"35":["C","\u092a\u094d\u0924"],"36":["X","."],"37":["C","\u0924\u094d\u0928"],"38":["X","\u00d7"],"39":["X","%"],"40":["X","("],"41":["X",")"],"42":["X","*"],"43":["X","+"],"44":["X",","],"45":["X","-"],"46":["X","."],"47":["X","/"],"48":["X","\u0966"],"49":["X","\u0967"],"50":["X","\u0968"],"51":["X","\u0969"],"52":["X","\u096a"],"53":["X","\u096b"],"54":["X","\u096c"],"55":["X","\u096d"],"56":["X","\u096e"],"57":["X","\u096f"],"58":["X",":"],"59":["X",";"],"60":["X","<"],"61":["X","="],"62":["X",">"],"63":["X","?"],"64":["C","\u091e\u094d\u091a"],"65":["M","\u094d\u0930"],"66":["C","\u0915\u094d\u091a"],"67":["C","\u0937\u094d\u091f"],"68":["C","\u0937\u094d\u0920"],"69":["C","\u0936\u094d\u0935"],"70":["C","\u0938\u094d\u0928"],"71":["C","\u0924\u094d\u0930"],"72":["X","\u0965"],"73":["C","\u0922\u094d\u0922"],"74":["C","\u091b\u094d\u0935"],"75":["M","\u094d\u092f"],"76":["C","\u0930\u0941"],"77":["C","\u0930\u0942"],"78":["C","\u0939\u0943"],"79":["C","\u0939\u094d\u0930"],"80":["C","\u0915\u094d\u0915"],"81":["C","\u0915\u094d\u0924"],"82":["C","\u0915\u094d\u0930"],"83":["H","\u0938\u094d"],"84":["C","\u091e\u094d\u091c"],"85":["X","\u2009"],"86":["C","\u0919\u094d\u0915"],"87":["C","\u0919\u094d\u0916"],"88":["C","\u0919\u094d\u0917"],"89":["C","\u0919\u094d\u0918"],"90":["R","\u0902"],"91":["X","["],"92":["C","\u091d\u094d\u0930"],"93":["X","]"],"94":["C","\u091f\u094d\u091f"],"95":["C","\u091f\u094d\u0920"],"96":["C","\u0915\u094d\u0935"],"97":["C","\u0921\u094d\u0921"],"98":["C","\u0921\u094d\u0922"],"99":["H","\u0937\u094d"],"100":["C","\u0938\u094d\u0930"],"101":["C","\u0926\u094d\u0917"],"102":["C","\u0926\u094d\u0918"],"103":["C","\u0926\u094d\u0926"],"104":["C","\u0926\u094d\u0927"],"105":["C","\u0926\u094d\u092c"],"106":["C","\u0926\u094d\u092d"],"107":["C","\u0926\u094d\u092e"],"108":["C","\u0926\u094d\u092f"],"109":["C","\u0926\u094d\u0935"],"110":["C","\u0920\u094d\u0920"],"111":["C","\u0936"],"112":["C","\u0936\u094d\u091a"],"113":["C","\u0939\u094d\u0928"],"114":["H","\u0939\u094d\u092e\u094d"],"115":["C","\u0939\u094d\u092f"],"116":["C","\u0939\u094d\u0932"],"117":["C","\u0939\u094d\u0935"],"118":["X","1"],"119":["X","2"],"120":["X","3"],"121":["X","4"],"122":["X","5"],"123":["X","6"],"124":["X","7"],"125":["X","8"],"126":["X","9"],"127":["M","\u0953"],"128":["H","\u0915\u094d"],"129":["H","\u0916\u094d"],"130":["H","\u0917\u094d"],"131":["H","\u0918\u094d"],"132":["C","\u0932\u094d\u0932"],"133":["H","\u091c\u094d"],"134":["H","\u091e\u094d"],"135":["H","\u0923\u094d"],"136":["H","\u0924\u094d"],"137":["H","\u0925\u094d"],"138":["H","\u0927\u094d"],"139":["H","\u0928\u094d"],"140":["H","\u092a\u094d"],"141":["H","\u092b\u094d"],"142":["H","\u092c\u094d"],"143":["H","\u092d\u094d"],"144":["H","\u092e\u094d"],"145":["H","\u091a\u094d"],"146":["H","\u091c\u094d"],"147":["H","\u091a\u094d\u091a\u094d"],"148":["H","\u091c\u094d\u091c\u094d"],"149":["H","\u091c\u093c\u094d"],"150":["C","\u0919\u094d\u0915\u094d\u0937"],"151":["X","\u2014"],"152":["H","\u0924\u094d\u0930\u094d"],"153":["H","\u091c\u094d\u091e\u094d"],"154":["X","\u2234"],"155":["V","\u0944"],"156":["X","\u2235"],"157":["C","\u0938\u094d\u0924\u094d\u0930"],"158":["H","\u0924\u094d\u0924\u094d"],"159":["H","\u0936\u094d\u0930\u094d"],"160":["M","\u0952"],"161":["M","\u0901"],"162":["M","\u0902"],"163":["V","\u0962"],"164":["X","\u2009"],"165":["X","\u0905"],"166":["C","\u0937\u094d\u091f\u094d\u0935"],"167":["X","\u0907"],"168":["P","\u0902"],"169":["X","\u0909"],"170":["X","\u090a"],"171":["X","\u090b"],"172":["X","\u0960"],"173":["X","\u090c"],"174":["X","0"],"175":["C","\u0916\u094d\u0928"],"176":["X","\u090f"],"177":["H","\u0939\u094d"],"178":["C","\u091f"],"179":["H","\u0936\u094d"],"180":["M","\u0902"],"181":["C","\u0926\u094d\u092c\u094d\u0930"],"182":["C","\u0932"],"183":["C","\u0915"],"184":["M","\u093c"],"185":["C","\u0916"],"186":["C","\u0916\u094d\u0930"],"187":["C","\u0917"],"188":["C","\u0926"],"189":["C","\u0921\u094d\u0921"],"190":["C","\u0919"],"191":["C","\u091a"],"192":["C","\u091b"],"193":["C","\u091c"],"194":["C","\u092a"],"195":["H","\u0935\u094d"],"196":["H","\u092f\u094d"],"197":["C","\u091f"],"198":["C","\u0920"],"199":["C","\u0921"],"200":["C","\u092b"],"201":["C","\u0922"],"203":["H","\u0932\u094d"],"204":["C","\u0924"],"205":["C","\u0925"],"206":["C","\u0926"],"207":["C","\u0927"],"208":["X","\u0964"],"209":["M","\u0903"],"210":["X","\u2018"],"211":["X","\u2019"],"212":["V","\u0947"],"213":["C","\u092c"],"214":["C","\u092d"],"215":["C","\u092e"],"216":["C","\u092f"],"217":["C","\u0928"],"218":["C","\u0930"],"219":["H","\u091d\u094d"],"220":["C","\u0932"],"221":["C","\u0933"],"222":["H","\u0915\u094d\u0937\u094d"],"223":["C","\u0935"],"224":["H","\u0936\u094d"],"225":["C","\u0937"],"226":["C","\u0938"],"227":["C","\u0939"],"228":["V","\u0941"],"229":["V","\u0942"],"230":["V","\u093e"],"231":["P",""],"232":["V","\u0940"],"233":["V","\u0941"],"234":["V","\u0942"],"235":["V","\u0943"],"236":["P","\u0902"],"237":["PR",""],"238":["C","\u0939\u0941"],"239":["C","\u0939\u0942"],"240":["V","\u0947"],"241":["V","\u0948"],"242":["V","\u0945"],"243":["H","\u0928\u094d\u0928\u094d"],"244":["V","\u094b"],"245":["V","\u094c"],"246":["C","\u092a\u094d\u0930"],"247":["M","\u094d"],"248":["X","\u0970"],"249":["X","\u093d"],"250":["X","\u0950"],"251":["C","\u0933"],"252":["R",""],"253":["M","\u094d\u0930"],"254":["M","\u094d\u0930"],"255":["X","\u200b"]},"walkman":{"33":["X","!"],"34":["H","\u0937\u094d"],"35":["C","\u0930\u0941"],"36":["X","+"],"37":["M","\u0903"],"38":["X","-"],"39":["C","\u0937\u094d\u0920"],"40":["X","("],"41":["X",")"],"42":["X","\u2019"],"43":["M","\u093c"],"44":["X","\u090f"],"45":["X","."],"46":["H","\u0923\u094d"],"47":["C","\u0927"],"48":["X","0"],"49":["X","1"],"50":["X","2"],"51":["X","3"],"52":["X","4"],"53":["X","5"],"54":["X","6"],"55":["X","7"],"56":["X","8"],"57":["X","9"],"58":["C","\u0930\u0942"],"59":["C","\u092f"],"60":["C","\u0922"],"61":["H","\u0924\u094d\u0930\u094d"],"62":["C","\u091d"],"63":["H","\u0918\u094d"],"64":["X","/"],"65":["X","\u0964"],"66":["C","\u0920"],"67":["H","\u092c\u094d"],"68":["H","\u0915\u094d"],"69":["H","\u092e\u094d"],"70":["H","\u0925\u094d"],"71":["C","\u0933"],"72":["H","\u092d\u094d"],"73":["H","\u092a\u094d"],"74":["C","\u0936\u094d\u0930"],"75":["C","\u091c\u094d\u091e"],"76":["H","\u0938\u094d"],"77":["C","\u0921"],"78":["C","\u091b"],"79":["H","\u0935\u094d"],"80":["H","\u091a\u094d"],"81":["H","\u092b\u094d"],"82":["H","\u0924\u094d"],"83":["V","\u0948"],"84":["H","\u091c\u094d"],"85":["H","\u0928\u094d"],"86":["C","\u091f"],"87":["V","\u0945"],"88":["H","\u0917\u094d"],"89":["H","\u0932\u094d"],"90":["R",""],"91":["H","\u0916\u094d"],"92":["X","?"],"93":["X",","],"94":["X","\u2018"],"95":["X",";"],"96":["C","\u0937\u094d\u091f"],"97":["M","\u0902"],"98":["X","\u0907"],"99":["C","\u092c"],"100":["C","\u0915"],"101":["C","\u092e"],"102":["P",""],"103":["C","\u0939"],"104":["V","\u0940"],"105":["C","\u092a"],"106":["C","\u0930"],"107":["V","\u093e"],"108":["C","\u0938"],"109":["X","\u0909"],"110":["C","\u0926"],"111":["C","\u0935"],"112":["C","\u091a"],"113":["V","\u0941"],"114":["C","\u0924"],"115":["V","\u0947"],"116":["C","\u091c"],"117":["C","\u0928"],"118":["X","\u0905"],"119":["V","\u0942"],"120":["C","\u0917"],"121":["C","\u0932"],"122":["M","\u094d\u0930"],"123":["H","\u0915\u094d\u0937\u094d"],"124":["C","\u0926\u094d\u092f"],"125":["C","\u0926\u094d\u0935"],"126":["M","\u094d"],"161":["M","\u0901"],"162":["M","\u0903"],"163":["PR",""],"165":["X","\u0950"],"166":["C","\u0919\u094d\u0915\u094d\u0937"],"167":["M","\u0901"],"168":["X","\u0950"],"169":["H","\u0936\u094d"],"170":["M","\u094d\u0930"],"171":["X","\u5350"],"172":["C","\u0937\u094d\u091f\u094d\u0935"],"173":["C","\u0933"],"177":["C","\u0916\u094d\u0930"],"178":["C","\u0919\u094d\u0918"],"179":["C","\u0915\u094d\u0935"],"180":["X","*"],"182":["X","\u201c"],"183":["C","\u0916"],"184":["C","\u0915\u094d\u091a"],"185":["C","\u091b\u094d\u0935"],"186":["H","\u091c\u093c\u094d"],"187":["X","%"],"188":["C","\u0919\u094d\u0916"],"189":["C","\u0926\u094d\u092d"],"191":["X","\u093d"],"193":["V","\u0943"],"194":["M","\u0953"],"195":["C","\u0926\u094d\u092c"],"196":["V","\u0941"],"197":["P","\u0902"],"200":["X",""],"203":["X","\u201d"],"208":["C","\u0916\u094d\u0928"],"225":["X","\u090c"],"227":["M","\u094d\u0930"],"233":["C","\u0915\u094d\u0930"],"234":["C","\u0919\u094d\u0915\u094d\u0937"],"235":["X","]"],"241":["C","\u0926\u094d\u0930"],"249":["X","\u096e"],"250":["C","\u0926\u094d\u092c\u094d\u0930"],"251":["C","\u0939\u094d\u0930"]}};
  const NALANDA = {"32":" ","33":"!","34":"\"","35":"#","36":"$","37":"%","38":"&","39":"'","40":"(","41":")","42":"*","43":"+","44":",","45":"-","46":".","47":"/","48":"0","49":"1","50":"2","51":"3","52":"4","53":"5","54":"6","55":"7","56":"8","57":"9","58":":","59":";","60":"<","61":"=","62":">","63":"?","64":"@","65":"A","66":"B","67":"C","68":"D","69":"E","70":"F","71":"G","72":"H","73":"I","74":"J","75":"K","76":"L","77":"M","78":"N","79":"O","80":"P","81":"Q","82":"R","83":"S","84":"T","85":"U","86":"V","87":"W","88":"X","89":"Y","90":"Z","91":"[","92":"\\","93":"]","94":"^","95":"_","96":"`","97":"a","98":"b","99":"c","100":"d","101":"e","102":"f","103":"g","104":"h","105":"i","106":"j","107":"k","108":"l","109":"m","110":"n","111":"o","112":"p","113":"q","114":"r","115":"s","116":"t","117":"u","118":"v","119":"w","120":"x","121":"y","122":"z","123":"{","124":"|","125":"}","126":"~","127":"\u016b\u0300","128":"\u00c4","129":"\u0100","130":"\u00c7","131":"\u00c9","132":"\u00d1","133":"\u00d6","134":"\u00dc","135":"\u00e1","136":"\u00e0","137":"\u00e2","138":"\u00e4","139":"\u00e3","140":"\u0101","141":"\u00e7","142":"\u00e9","143":"\u00e8","144":"\u00ea","145":"\u2018","146":"\u2019","147":"\u201c","148":"\u201d","149":"\u00b4","150":"\u2013","151":"\u2014","152":"\u00f2","153":"\u00f4","154":"\u00f6","155":"\u0129","156":"\u00fa","157":"\u00f9","158":"\u00fb","159":"\u00fc","160":"\u2020","161":"\u00b0","162":"\u1e6d","163":"\u00a3","164":"\u0323","165":"\u0324","166":"\u1e63","167":"s\u0324","168":"\u1e62","169":"S\u0324","170":"\u1e93","171":"z\u0324","172":"\u1e25","173":"r\u0304\u0301","174":"\u1e95","175":"\u00d8","176":"\u0101\u0303","177":"\u0303","178":"\u012b\u0303","179":"m\u0310","180":"\u0303\u0304","181":"\u00b5","182":"\u012b","183":"\u0103","184":"\u012d","185":"\u0112","186":"\u012a","187":"\u00aa","188":"\u00ba","189":"\u2126","190":"\u1e5b","191":"\u1e5f","192":"\u1e5d","193":"\u1e5b\u0301","194":"\u1e5b\u0300","195":"\u1e43","196":"\u1e47","197":"\u1e41","198":"\u1e45","199":"\u1e49","200":"\u012b\u0301","201":"\u012b\u0300","203":"\u1e40","204":"\u1e44","205":"\u1e48","206":"\u1e0d","207":"\u1e0c","208":"\u2020","209":"\u0306","210":"\u25cf","211":"\u00a7","212":"g\u0331h\u0331","213":"\u00b0","214":"\u00f7","215":"r\u0304","216":"\u00ff","217":"\u0178","218":"\u00ef","219":"\u00f1","220":"\u015b","221":"\u015a","222":"\u0332","223":"\u0332","224":"\u00eb","225":"\u00ed","226":"g\u0331","227":"G\u0331","228":"\u00a4","229":"\u00c2","230":"\u00ca","231":"\u00c1","232":"\u00cb","233":"\u00c8","234":"\u00cd","235":"\u00ce","236":"\u00cf","237":"\u00cc","238":"\u00d3","239":"\u00d4","240":"\u0303","241":"\u00d2","242":"\u00da","243":"\u00db","244":"\u00d9","245":"\u00c0","246":"\u0128","247":"\u016b\u0301","248":"\u00ec","249":"\u00ee","250":"\u00f3","251":"\u0306","252":"\u1e36","253":"\u1e3a","254":"\u0101\u0301","255":"\u0101\u0300"};
  // Nalanda's accents are zero-width glyphs typed BEFORE the letter they sit on (a dead-key layout);
  // each has a lower-case and a capital-height version
  const NAL_PREFIX = { 94: '́', 96: '̆', 124: '̌', 126: '̆', 160: '̃', 161: '̣', 163: '̤', 164: '̣', 165: '̤', 175: '̱', 177: '̃', 180: '̃̄', 181: '̄', 187: '̄', 188: '̌', 189: '́', 209: '̆', 214: '̃', 240: '̃', 251: '̆' };
  const NAL_CAP = { '́': 94, '̆': 209, '̃': 160, '̄': 187, '̌': 188 };
  const NAL_LC = { '́': 189, '̆': 126, '̃': 214, '̄': 181, '̌': 124, '̣': 164, '̤': 165, '̱': 175 };
  Object.assign(NALANDA, NAL_PREFIX);
  NALANDA[202] = ''; // an empty spacer
  const VIRAMA = '्';
  // text from PageMaker arrives decoded as Windows-1252, and from Word symbol fonts as U+F0xx: back to byte codes
  const B2C = [];
  const C2B = new Map();
  try {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;
    const dec = new TextDecoder('windows-1252').decode(all);
    for (let i = 0; i < 256; i++) { B2C[i] = dec[i]; C2B.set(dec.charCodeAt(i), i); }
  } catch (e) { for (let i = 0; i < 256; i++) { B2C[i] = String.fromCharCode(i); C2B.set(i, i); } }
  const byteOf = (c) => (c >= 0xf000 && c <= 0xf0ff ? c - 0xf000 : C2B.has(c) ? C2B.get(c) : c < 256 ? c : -1);
  const charOf = (b) => B2C[b] || String.fromCharCode(b);
  const DEV = { chanakya: 1, chanakyamath: 1, walkman: 1 };

  // ------------------------------------------------------------------ fonts
  function encodingForFont(name) {
    const n = String(name || '').replace(/[\s_-]+/g, '').toLowerCase();
    if (!n || /^bv/.test(n)) return null;
    if (/^walkmanchanakya/.test(n)) return 'walkman';
    if (/^chanakyamath/.test(n)) return 'chanakyamath';
    if (/^chanakya/.test(n)) return 'chanakya';
    if (/^nalanda/.test(n)) return 'nalanda';
    return null;
  }
  const style = (n) => ({ bold: /bold|bld|bd|heavy|black/i.test(n), italic: /ital|itl|obl/i.test(n) });
  // the Unicode font that carries the same design
  function unicodeFont(name) {
    const enc = encodingForFont(name);
    if (!enc) return null;
    const n = String(name);
    const st = style(n.replace(/^walkman-chanakya-?|-?901/gi, ''));
    if (enc === 'walkman') return Object.assign({ font: 'BVChitkala Hindi' }, st);
    if (enc === 'chanakyamath') return Object.assign({ font: 'BVChitkala Math' }, st);
    if (enc === 'chanakya') return Object.assign({ font: 'BVChitkala' }, st);
    // Nalanda: Garamond is BV Nanda; the others are Times, Palatino, Helvetica, Baskerville and Bookman cuts
    const k = n.replace(/[\s_-]+/g, '').toLowerCase();
    const font = /tim/.test(k) ? 'Times New Roman' : /pala/.test(k) ? 'Palatino Linotype' : /hel/.test(k) ? 'Arial' : /bas/.test(k) ? 'Baskerville Old Face' : /boo/.test(k) ? 'Bookman Old Style' : 'BVNanda';
    return Object.assign({ font }, style(n.replace(/^nalanda(gara?|tim|pala|hel|bas|book)?/i, '')));
  }
  const label = (enc) => ({ chanakya: 'Chanakya → Unicode Devanagari', chanakyamath: 'Chanakyamath → Unicode Devanagari', walkman: 'Walkman-Chanakya → Unicode Devanagari', nalanda: 'Nalanda → Unicode IAST' }[enc] || '');

  // ------------------------------------------------------------------ legacy -> Unicode
  const PRE_MARKS = /^[़]/; // nukta joins the consonant
  const JOINS = { '़': 1, '्र': 1, '्य': 1 };
  function tokens(s, tab) {
    const out = [];
    for (const ch of s) {
      const c = byteOf(ch.codePointAt(0));
      const e = c >= 0 ? tab[c] : null;
      if (!e) { out.push({ k: 'X', s: ch }); continue; }
      if (e[0] === 'PR') { out.push({ k: 'P', s: '', reph: true }); continue; }
      out.push({ k: e[0], s: e[1] });
    }
    return out;
  }
  // consonant clusters: half forms, then a full consonant (a half form followed by the aa-sign is the full letter),
  // with its nukta, rakar and yaphala
  function clusters(tk) {
    const out = [];
    for (let i = 0; i < tk.length; ) {
      const t = tk[i];
      if (t.k !== 'H' && t.k !== 'C') { out.push(t); i++; continue; }
      let s = '';
      let full = false;
      while (i < tk.length && (tk[i].k === 'H' || tk[i].k === 'C')) {
        const u = tk[i];
        if (u.k === 'C') {
          // a conjunct with an explicit virama that joins the next consonant
          const v = tk[i + 1], n = tk[i + 2];
          if (v && v.k === 'M' && v.s === VIRAMA && n && (n.k === 'C' || n.k === 'H')) { s += u.s + VIRAMA; i += 2; continue; }
          s += u.s; i++; full = true; break;
        }
        if (tk[i + 1] && tk[i + 1].k === 'V' && tk[i + 1].s === 'ा') { s += u.s.slice(0, -1); i += 2; full = true; break; }
        s += u.s; i++;
      }
      if (full) while (i < tk.length && tk[i].k === 'M' && JOINS[tk[i].s]) { s += tk[i].s; i++; }
      out.push({ k: 'S', s, half: !full });
    }
    return out;
  }
  const VOWELS = /^[ऄ-औॠॡॲ-ॷ]/;
  function syllables(tk) {
    const out = [];
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i];
      if (t.k === 'P') {
        // the i-sign is written before the consonant cluster it follows in Unicode
        const n = tk[i + 1];
        if (n && n.k === 'S') {
          out.push({ k: 'S', s: n.s + 'ि' + t.s, reph: !!t.reph });
          i++;
          continue;
        }
        out.push({ k: 'S', s: 'ि' + t.s, reph: !!t.reph });
        continue;
      }
      if (t.k === 'X' && VOWELS.test(t.s)) { out.push({ k: 'S', s: t.s, vowel: true }); continue; }
      if (t.k === 'S') { out.push({ k: 'S', s: t.s, half: t.half }); continue; }
      const last = out[out.length - 1];
      if (last && last.k === 'S' && !last.half && (t.k === 'V' || t.k === 'M')) { last.s += t.s; continue; }
      if (last && last.k === 'S' && t.k === 'R') { last.reph = true; last.s += t.s; continue; }
      out.push(t.k === 'R' ? { k: 'X', s: 'र्' + t.s } : t);
    }
    return out;
  }
  function tidy(syl) {
    let s = syl.s;
    if (syl.reph) {
      if (syl.vowel && s[0] === 'इ') s = 'ई' + s.slice(1); // i + reph is the long ii (Kruti style)
      else s = 'र्' + s;
    }
    // vowel letters built from parts
    s = s.replace(/अा/g, 'आ').replace(/आे/g, 'ओ').replace(/आै/g, 'औ')
      .replace(/अो/g, 'ओ').replace(/अौ/g, 'औ').replace(/एे/g, 'ऐ').replace(/अॉ/g, 'ऑ').replace(/अॅ/g, 'ऑ');
    // o and au signs built from aa + e / ai
    s = s.replace(/ाे/g, 'ो').replace(/ेा/g, 'ो').replace(/ाै/g, 'ौ').replace(/ैा/g, 'ौ').replace(/ाॅ/g, 'ॉ');
    // nukta before vowel signs, anusvara and candrabindu after them
    s = s.replace(/([ा-ौॢॣ]+)़/g, '़$1');
    for (let k = 0; k < 3; k++) s = s.replace(/([ँंः])([ा-ौॢॣ])/g, '$2$1');
    return s;
  }
  function toUnicode(s, enc) {
    if (enc === 'nalanda') {
      let o = '';
      let pending = '';
      for (const ch of s) {
        const c = byteOf(ch.codePointAt(0));
        if (NAL_PREFIX[c]) { pending += NAL_PREFIX[c]; continue; }
        o += (c >= 0 && NALANDA[c] != null ? NALANDA[c] : ch) + pending;
        pending = '';
      }
      return (o + pending).normalize('NFC');
    }
    const tab = T[enc];
    if (!tab) return s;
    return syllables(clusters(tokens(s, tab))).map((t) => (t.k === 'S' ? tidy(t) : t.s)).join('');
  }
  // a run that starts with these belongs to the syllable at the end of the run before
  function continues(enc, ch) {
    const tab = T[enc];
    if (!tab) return false;
    const e = tab[byteOf(ch.charCodeAt(0))];
    return !!e && (e[0] === 'V' || e[0] === 'R' || (e[0] === 'M' && e[1] !== 'ः'));
  }

  // ------------------------------------------------------------------ Unicode -> legacy (for saving back)
  const REV = {};
  function rev(enc) {
    if (REV[enc]) return REV[enc];
    const r = { C: new Map(), H: new Map(), V: new Map(), M: new Map(), X: new Map(), P: null, PA: null, R: null, RA: null, PR: null, maxC: 1 };
    const tab = T[enc];
    for (const k of Object.keys(tab).map(Number).sort((a, b) => (a < 32) - (b < 32) || a - b)) {
      const [kind, s] = tab[k];
      const ch = charOf(k);
      if (kind === 'P') { if (s === '' && !r.P) r.P = ch; else if (s && !r.PA) r.PA = ch; continue; }
      if (kind === 'PR') { if (!r.PR) r.PR = ch; continue; }
      if (kind === 'R') { if (s === '' && !r.R) r.R = ch; else if (s && !r.RA) r.RA = ch; continue; }
      const m = r[kind];
      if (m && s && !m.has(s)) { m.set(s, ch); if (kind === 'C' || kind === 'H') r.maxC = Math.max(r.maxC, [...s].length); }
    }
    // a full consonant with no glyph of its own is its half form plus the aa-sign
    return (REV[enc] = r);
  }
  const CONS = '[क-हक़-य़ळ]़?';
  const SYL = new RegExp(`((?:${CONS}्\u200d?)*${CONS})(्(?![क-ह]))?([ा-ौॢॣ]*)([ँ-ः]*)`, 'g');
  function clusterToLegacy(r, s) {
    // greedy: longest conjunct the font has, else half forms
    let out = '';
    const cs = [...s];
    let i = 0;
    while (i < cs.length) {
      let hit = null;
      for (let n = Math.min(r.maxC, cs.length - i); n >= 1 && !hit; n--) {
        const part = cs.slice(i, i + n).join('');
        const rest = i + n === cs.length;
        if (rest && r.C.has(part)) hit = [r.C.get(part), n];
        else if (!rest && cs[i + n] === VIRAMA && r.H.has(part + VIRAMA)) hit = [r.H.get(part + VIRAMA), n + 1];
        else if (rest && r.H.has(part + VIRAMA) && r.V.has('ा')) hit = [r.H.get(part + VIRAMA) + r.V.get('ा'), n];
        else if (!rest && cs[i + n] === VIRAMA && r.C.has(part) && r.M.has(VIRAMA)) hit = [r.C.get(part) + r.M.get(VIRAMA), n + 1];
      }
      if (!hit) { const c = cs[i]; hit = [r.X.get(c) || r.M.get(c) || c, 1]; }
      // rakar and yaphala after a full consonant
      out += hit[0];
      i += hit[1];
      if (i < cs.length - 1 && cs[i] === VIRAMA && (cs[i + 1] === 'र' || cs[i + 1] === 'य') && i + 2 === cs.length && r.M.has(VIRAMA + cs[i + 1])) {
        out += r.M.get(VIRAMA + cs[i + 1]);
        i += 2;
      }
    }
    return out;
  }
  function fromUnicode(s, enc) {
    if (enc === 'nalanda') {
      const back = {};
      for (const [k, v] of Object.entries(NALANDA)) if (back[v] == null && !NAL_PREFIX[k] && v) back[v] = charOf(+k);
      let o = '';
      const t = s.normalize('NFC');
      for (let i = 0; i < t.length; ) {
        let hit = null;
        for (let n = 3; n >= 1 && !hit; n--) { const p = t.slice(i, i + n); if (back[p] != null) hit = [back[p], n]; }
        if (!hit) {
          // a letter with accents the font has no single glyph for: the accents first, then the letter
          const d = t[i].normalize('NFD');
          const base = d[0], marks = [...d.slice(1)];
          const cap = base !== base.toLowerCase() || /[bdfhklt]/.test(base);
          const pre = marks.map((m) => { const k = (cap && NAL_CAP[m]) || NAL_LC[m]; return k ? charOf(k) : m; }).join('');
          hit = [marks.length ? pre + (back[base] != null ? back[base] : base) : back[base] != null ? back[base] : t[i], 1];
        }
        o += hit[0];
        i += hit[1];
      }
      return o;
    }
    if (!T[enc]) return s;
    const r = rev(enc);
    const t = s.replace(/ई/g, '\ue000'); // long ii: i + reph
    return t.replace(SYL, (all, cl, vir, signs, marks, off) => {
      let reph = false;
      let c = cl;
      if (c.startsWith('र्') && c.length > 2) { reph = true; c = c.slice(2); }
      let pre = '';
      let post = '';
      let sg = signs;
      if (sg.includes('ि')) { sg = sg.replace('ि', ''); pre = reph && r.PR ? r.PR : r.P || ''; if (reph && r.PR) reph = false; }
      let mk = marks;
      if (pre === r.P && mk === 'ं' && r.PA && !sg) { pre = r.PA; mk = ''; }
      for (const ch of sg) post += r.V.get(ch) || (ch === 'ो' ? (r.V.get('ा') || '') + (r.V.get('े') || '') : ch === 'ौ' ? (r.V.get('ा') || '') + (r.V.get('ै') || '') : ch);
      if (vir) post += r.M.get(VIRAMA) || '';
      let tail = '';
      if (reph) tail = mk === 'ं' && r.RA ? ((mk = ''), r.RA) : r.R || '';
      for (const ch of mk) post += r.M.get(ch) || ch;
      return pre + clusterToLegacy(r, c) + post + tail;
    }).replace(/[ऀ-ॿ]/g, (ch) => {
      if (ch === 'र') return r.C.get(ch) || ch;
      const x = r.X.get(ch) || r.M.get(ch) || r.V.get(ch);
      if (x) return x;
      // vowel letters built from parts
      const parts = { 'आ': 'अा', 'ओ': 'अो', 'औ': 'अौ', 'ऐ': 'एे' }[ch];
      return parts ? [...parts].map((p) => r.X.get(p) || r.V.get(p) || (p === 'ो' ? (r.V.get('ा') || '') + (r.V.get('े') || '') : p === 'ौ' ? (r.V.get('ा') || '') + (r.V.get('ै') || '') : p)).join('') : ch;
    }).replace(/\ue000/g, () => (r.X.get('इ') || '') + (r.R || ''));
  }

  BV.DevLegacy = { encodingForFont, unicodeFont, toUnicode, fromUnicode, continues, label, isDev: (enc) => !!DEV[enc] || enc === 'nalanda', tables: T };
})();
