// Eingebauter Katalog bekannter Filme und Serien. Damit funktionieren Empfehlungen und „Ähnliche“ auch ohne Internet.
// Alles andere findet die Suche online (Serien über TVmaze, Filme über iTunes/Apple TV) oder die KI-Empfehlung.
// Aufbau pro Zeile: Art (f = Film, s = Serie) | Titel | Jahr | Genres | Merkmale | Originaltitel (falls anders)
// Merkmale beschreiben Stimmung und Themen. Sie zählen bei Empfehlungen mehr als Genres, weil sie genauer sind.

export const GENRES = ["Action", "Abenteuer", "Animation", "Doku", "Drama", "Familie", "Fantasy", "Historie", "Horror",
  "Komödie", "Krimi", "Krieg", "Musik", "Mystery", "Reality", "Romantik", "Sci-Fi", "Sport", "Thriller", "Western"];

const RAW = `
s|Dark|2017|Mystery,Sci-Fi,Drama|zeitreise,düster,komplex,deutsch,kleinstadt,familiengeheimnis
s|Stranger Things|2016|Sci-Fi,Horror,Drama|80er,teenager,übernatürlich,spannend,kleinstadt,freundschaft,kult
s|Breaking Bad|2008|Krimi,Drama,Thriller|drogen,antiheld,spannend,düster,kult,charakterstudie
s|Better Call Saul|2015|Krimi,Drama|antiheld,anwalt,charakterstudie,ruhig,kult
s|Game of Thrones|2011|Fantasy,Drama,Abenteuer|mittelalter,intrigen,episch,brutal,drachen,kult,romanvorlage
s|House of the Dragon|2022|Fantasy,Drama|mittelalter,intrigen,episch,drachen,brutal,romanvorlage
s|Die Ringe der Macht|2022|Fantasy,Abenteuer|episch,magie,mittelalter,romanvorlage|The Lord of the Rings: The Rings of Power
s|The Witcher|2019|Fantasy,Action,Abenteuer|magie,monster,mittelalter,romanvorlage,brutal
s|The Crown|2016|Drama,Historie|königshaus,britisch,wahre-geschichte,kostüm,politik,ruhig
s|Bridgerton|2020|Romantik,Drama|kostüm,liebe,britisch,leicht,romanvorlage,skandal
s|Downton Abbey|2010|Drama,Historie|kostüm,britisch,familie,adel,wohlfühl,ruhig
s|Outlander|2014|Romantik,Drama,Fantasy|zeitreise,kostüm,liebe,schottland,romanvorlage,historie
s|Friends|1994|Komödie,Romantik|sitcom,freundschaft,lustig,wohlfühl,kult,leicht
s|How I Met Your Mother|2005|Komödie,Romantik|sitcom,freundschaft,lustig,wohlfühl,leicht,liebe
s|The Big Bang Theory|2007|Komödie|sitcom,nerds,lustig,leicht,freundschaft
s|The Office|2005|Komödie|sitcom,büro,mockumentary,lustig,fremdscham,kult|The Office (US)
s|Brooklyn Nine-Nine|2013|Komödie,Krimi|sitcom,polizei,lustig,wohlfühl,leicht,team
s|Parks and Recreation|2009|Komödie|sitcom,mockumentary,lustig,wohlfühl,politik,team
s|Modern Family|2009|Komödie,Familie|sitcom,mockumentary,familie,lustig,wohlfühl
s|New Girl|2011|Komödie,Romantik|sitcom,freundschaft,wg,lustig,leicht
s|Scrubs|2001|Komödie,Drama|sitcom,krankenhaus,lustig,gefühlvoll,freundschaft
s|Two and a Half Men|2003|Komödie|sitcom,lustig,leicht
s|Ted Lasso|2020|Komödie,Sport,Drama|fußball,wohlfühl,herzlich,lustig,britisch,team
s|Schitt's Creek|2015|Komödie|familie,wohlfühl,lustig,herzlich,kleinstadt
s|Abbott Elementary|2021|Komödie|sitcom,mockumentary,schule,wohlfühl,lustig
s|Only Murders in the Building|2021|Komödie,Krimi,Mystery|whodunit,lustig,podcast,new-york,leicht
s|Wednesday|2022|Komödie,Fantasy,Mystery|teenager,schule,übernatürlich,schwarzer-humor,whodunit
s|The Bear|2022|Drama,Komödie|kochen,stress,familie,charakterstudie,intensiv
s|Succession|2018|Drama|reiche,familie,intrigen,schwarzer-humor,macht,charakterstudie
s|The White Lotus|2021|Drama,Komödie|reiche,urlaub,satire,schwarzer-humor,whodunit
s|Mad Men|2007|Drama|60er,werbung,charakterstudie,ruhig,kult
s|The Sopranos|1999|Krimi,Drama|mafia,antiheld,familie,kult,charakterstudie|Die Sopranos
s|Peaky Blinders|2013|Krimi,Drama,Historie|gangster,britisch,20er,brutal,stilvoll,familie
s|Boardwalk Empire|2010|Krimi,Drama,Historie|gangster,20er,prohibition,brutal,kostüm
s|Narcos|2015|Krimi,Drama|drogen,wahre-geschichte,kolumbien,brutal,spannend
s|Ozark|2017|Krimi,Drama,Thriller|drogen,geldwäsche,familie,düster,spannend
s|Haus des Geldes|2017|Krimi,Thriller,Action|heist,spannend,spanisch,twist,team|La Casa de Papel
s|Prison Break|2005|Thriller,Action,Krimi|gefängnis,flucht,spannend,twist
s|Dexter|2006|Krimi,Thriller,Drama|serienkiller,antiheld,düster,spannend
s|Mindhunter|2017|Krimi,Drama|serienkiller,fbi,wahre-geschichte,psychologie,ruhig,düster
s|True Detective|2014|Krimi,Drama,Mystery|ermittler,düster,atmosphärisch,anthologie,komplex
s|Sherlock|2010|Krimi,Mystery,Drama|detektiv,britisch,clever,twist,kurz-staffeln
s|Broadchurch|2013|Krimi,Drama|whodunit,britisch,kleinstadt,düster,gefühlvoll
s|Line of Duty|2012|Krimi,Thriller|polizei,korruption,britisch,spannend,verhör
s|Mare of Easttown|2021|Krimi,Drama|whodunit,kleinstadt,düster,miniserie,ermittlerin
s|Big Little Lies|2017|Drama,Krimi,Mystery|frauen,reiche,geheimnisse,whodunit,romanvorlage
s|Sharp Objects|2018|Thriller,Drama,Mystery|kleinstadt,düster,psychologie,miniserie,romanvorlage
s|Behind Her Eyes|2021|Thriller,Mystery,Drama|twist,psychologie,britisch,übernatürlich,miniserie,romanvorlage
s|You|2018|Thriller,Krimi,Drama|stalker,psychologie,antiheld,spannend,romanvorlage|You – Du wirst mich lieben
s|Squid Game|2021|Thriller,Drama,Action|koreanisch,überleben,gesellschaftskritik,brutal,spannend
s|Alice in Borderland|2020|Thriller,Sci-Fi,Action|japanisch,überleben,spiele,spannend,brutal
s|Black Mirror|2011|Sci-Fi,Thriller,Drama|technik,dystopie,anthologie,düster,gesellschaftskritik,twist
s|Westworld|2016|Sci-Fi,Western,Mystery|ki,komplex,philosophisch,twist,düster
s|Severance|2022|Sci-Fi,Thriller,Mystery|büro,komplex,dystopie,twist,atmosphärisch
s|The Expanse|2015|Sci-Fi,Drama|weltraum,politik,romanvorlage,komplex,episch
s|The Mandalorian|2019|Sci-Fi,Abenteuer,Action|star-wars,weltraum,western,familie,kult
s|Andor|2022|Sci-Fi,Drama,Thriller|star-wars,weltraum,rebellion,politik,ernst
s|Doctor Who|2005|Sci-Fi,Abenteuer|zeitreise,weltraum,britisch,kult,skurril
s|Star Trek: Strange New Worlds|2022|Sci-Fi,Abenteuer|weltraum,team,optimistisch,episodisch
s|The Last of Us|2023|Drama,Horror,Sci-Fi|endzeit,zombies,gefühlvoll,spielvorlage,reise
s|The Walking Dead|2010|Horror,Drama|zombies,endzeit,überleben,brutal,lang
s|Fallout|2024|Sci-Fi,Abenteuer,Komödie|endzeit,spielvorlage,schwarzer-humor,brutal
s|The Boys|2019|Action,Sci-Fi,Komödie|superhelden,satire,brutal,schwarzer-humor
s|WandaVision|2021|Fantasy,Mystery,Komödie|superhelden,marvel,sitcom-parodie,miniserie
s|Loki|2021|Fantasy,Sci-Fi,Abenteuer|superhelden,marvel,zeitreise,lustig
s|Arcane|2021|Animation,Fantasy,Action|spielvorlage,steampunk,geschwister,episch,düster
s|Invincible|2021|Animation,Action,Sci-Fi|superhelden,brutal,erwachsenen-animation,coming-of-age
s|Rick and Morty|2013|Animation,Komödie,Sci-Fi|erwachsenen-animation,skurril,schwarzer-humor,weltraum,kult
s|Die Simpsons|1989|Animation,Komödie|familie,satire,kult,lustig,episodisch|The Simpsons
s|BoJack Horseman|2014|Animation,Komödie,Drama|erwachsenen-animation,depression,hollywood,charakterstudie,schwarzer-humor
s|Avatar – Der Herr der Elemente|2005|Animation,Abenteuer,Fantasy|magie,reise,coming-of-age,familie,episch|Avatar: The Last Airbender
s|Attack on Titan|2013|Animation,Action,Fantasy|anime,brutal,düster,episch,twist
s|Death Note|2006|Animation,Thriller,Mystery|anime,psychologie,clever,katz-und-maus
s|One Piece|2023|Abenteuer,Fantasy,Komödie|piraten,mangavorlage,freundschaft,bunt,reise
s|Lost|2004|Mystery,Abenteuer,Drama|insel,überleben,rätsel,twist,kult
s|Twin Peaks|1990|Mystery,Krimi,Drama|kleinstadt,skurril,surreal,kult,whodunit
s|Akte X|1993|Sci-Fi,Mystery,Krimi|übernatürlich,aliens,fbi,episodisch,kult|The X-Files
s|Supernatural|2005|Fantasy,Horror,Drama|übernatürlich,brüder,monster,roadtrip,lang
s|Buffy – Im Bann der Dämonen|1997|Fantasy,Horror,Komödie|übernatürlich,teenager,monster,kult|Buffy the Vampire Slayer
s|The Haunting of Hill House|2018|Horror,Drama,Mystery|geister,familie,gefühlvoll,düster,miniserie
s|Midnight Mass|2021|Horror,Drama|religion,kleinstadt,düster,miniserie,ruhig
s|American Horror Story|2011|Horror,Thriller|anthologie,brutal,skurril,übernatürlich
s|Yellowjackets|2021|Drama,Horror,Mystery|überleben,teenager,90er,zwei-zeitebenen,düster
s|From|2022|Horror,Mystery,Sci-Fi|kleinstadt,gefangen,rätsel,monster,spannend
s|The Handmaid's Tale|2017|Drama,Sci-Fi|dystopie,frauen,unterdrückung,düster,romanvorlage|The Handmaid's Tale – Der Report der Magd
s|Chernobyl|2019|Drama,Historie|wahre-geschichte,katastrophe,miniserie,düster,ernst
s|Band of Brothers|2001|Krieg,Drama,Historie|zweiter-weltkrieg,wahre-geschichte,miniserie,episch|Band of Brothers – Wir waren wie Brüder
s|Shōgun|2024|Drama,Historie,Abenteuer|japan,samurai,intrigen,kostüm,romanvorlage,episch
s|Vikings|2013|Action,Drama,Historie|wikinger,mittelalter,brutal,kampf
s|The Last Kingdom|2015|Action,Drama,Historie|wikinger,mittelalter,brutal,kampf,britisch
s|Babylon Berlin|2017|Krimi,Drama,Historie|20er,berlin,deutsch,stilvoll,romanvorlage,politik
s|Das Boot|2018|Krieg,Drama,Thriller|zweiter-weltkrieg,deutsch,u-boot,spannend
s|Deutschland 83|2015|Drama,Thriller,Historie|80er,kalter-krieg,spion,deutsch
s|How to Sell Drugs Online (Fast)|2019|Komödie,Krimi|teenager,deutsch,drogen,lustig,schule
s|Der Tatortreiniger|2011|Komödie|deutsch,schwarzer-humor,skurril,kurz-folgen,kult
s|Stromberg|2004|Komödie|deutsch,büro,mockumentary,fremdscham,kult
s|4 Blocks|2017|Krimi,Drama|deutsch,berlin,gangster,clan,brutal
s|Kleo|2022|Action,Thriller,Komödie|deutsch,ddr,rache,schwarzer-humor,stilvoll
s|Barbaren|2020|Action,Drama,Historie|deutsch,römer,kampf,historie
s|Tribes of Europa|2021|Sci-Fi,Abenteuer|deutsch,endzeit,dystopie,geschwister
s|Dark Matter|2024|Sci-Fi,Thriller|parallelwelten,familie,romanvorlage,spannend
s|3 Body Problem|2024|Sci-Fi,Mystery,Drama|aliens,wissenschaft,komplex,romanvorlage
s|Silo|2023|Sci-Fi,Mystery,Drama|dystopie,bunker,rätsel,romanvorlage,spannend
s|Foundation|2021|Sci-Fi,Drama|weltraum,episch,romanvorlage,imperium
s|Reacher|2022|Action,Krimi,Thriller|ermittler,kampf,romanvorlage,spannend
s|Jack Ryan|2018|Action,Thriller|spion,cia,romanvorlage,spannend|Tom Clancy's Jack Ryan
s|Slow Horses|2022|Thriller,Drama,Komödie|spion,britisch,schwarzer-humor,romanvorlage,team
s|The Night Agent|2023|Action,Thriller|spion,verschwörung,spannend,romanvorlage
s|Bodyguard|2018|Thriller,Drama|britisch,politik,spannend,miniserie,personenschutz
s|Homeland|2011|Thriller,Drama|spion,cia,terror,spannend,politik
s|24|2001|Action,Thriller|terror,echtzeit,spannend,kult|24 – Twenty Four
s|House of Cards|2013|Drama,Thriller|politik,intrigen,macht,antiheld
s|Suits|2011|Drama,Komödie|anwalt,new-york,stilvoll,leicht,freundschaft
s|Grey's Anatomy|2005|Drama,Romantik|krankenhaus,ärzte,liebe,gefühlvoll,lang
s|Dr. House|2004|Drama,Mystery|krankenhaus,ärzte,rätsel,antiheld,clever|House
s|The Good Doctor|2017|Drama|krankenhaus,ärzte,autismus,gefühlvoll,herzlich
s|This Is Us|2016|Drama,Familie|familie,gefühlvoll,zwei-zeitebenen,tränen,herzlich
s|Gilmore Girls|2000|Komödie,Drama,Familie|mutter-tochter,kleinstadt,wohlfühl,schnell-geredet,kult
s|Virgin River|2019|Romantik,Drama|kleinstadt,liebe,wohlfühl,romanvorlage,natur
s|Sweet Magnolias|2020|Romantik,Drama|kleinstadt,freundinnen,wohlfühl,romanvorlage
s|Emily in Paris|2020|Komödie,Romantik|paris,mode,leicht,liebe,arbeit
s|Sex and the City|1998|Komödie,Romantik|new-york,freundinnen,liebe,mode,kult
s|Gossip Girl|2007|Drama,Romantik|teenager,reiche,new-york,intrigen,skandal
s|Pretty Little Liars|2010|Mystery,Drama,Thriller|teenager,freundinnen,whodunit,geheimnisse,romanvorlage
s|Riverdale|2017|Drama,Mystery,Krimi|teenager,kleinstadt,whodunit,comicvorlage
s|The Vampire Diaries|2009|Fantasy,Romantik,Drama|vampire,teenager,liebe,übernatürlich,romanvorlage|Vampire Diaries
s|Elite|2018|Thriller,Drama|teenager,schule,reiche,whodunit,spanisch
s|Sex Education|2019|Komödie,Drama|teenager,schule,britisch,herzlich,lustig,coming-of-age
s|Heartstopper|2022|Romantik,Drama|teenager,queer,britisch,wohlfühl,herzlich,comicvorlage
s|Euphoria|2019|Drama|teenager,drogen,intensiv,stilvoll,düster
s|13 Reasons Why|2017|Drama,Mystery|teenager,schule,ernst,düster,romanvorlage|Tote Mädchen lügen nicht
s|Never Have I Ever|2020|Komödie,Drama|teenager,schule,leicht,herzlich,coming-of-age|Noch nie in meinem Leben …
s|Cobra Kai|2018|Action,Komödie,Drama|karate,80er-fortsetzung,teenager,lustig,sport
s|Ginny & Georgia|2021|Komödie,Drama|mutter-tochter,kleinstadt,geheimnisse,teenager
s|Anne with an E|2017|Drama,Familie|kostüm,mädchen,herzlich,romanvorlage,natur|Anne mit einem E
s|Der Pinguin|2024|Krimi,Drama|gangster,dc,düster,antiheld|The Penguin
s|Baby Reindeer|2024|Drama,Thriller|stalker,wahre-geschichte,britisch,miniserie,intensiv
s|Adolescence|2025|Drama,Krimi|teenager,britisch,miniserie,intensiv,plansequenz,gesellschaftskritik
s|Unorthodox|2020|Drama|religion,berlin,frauen,miniserie,wahre-geschichte
s|Das Damengambit|2020|Drama,Sport|schach,60er,frauen,miniserie,stilvoll,romanvorlage|The Queen's Gambit
s|Maid|2021|Drama|mutter,armut,frauen,miniserie,gefühlvoll,wahre-geschichte
s|Unbelievable|2019|Krimi,Drama|wahre-geschichte,ermittlerinnen,miniserie,ernst
s|Dahmer|2022|Krimi,Drama,Horror|serienkiller,wahre-geschichte,düster,miniserie|Dahmer – Monster: Die Geschichte von Jeffrey Dahmer
s|Making a Murderer|2015|Doku,Krimi|true-crime,justiz,doku-serie
s|Tiger King|2020|Doku|true-crime,skurril,tiere,doku-serie
s|Planet Erde|2006|Doku|natur,tiere,wunderschön,ruhig,doku-serie|Planet Earth
s|Unser Planet|2019|Doku|natur,tiere,klima,wunderschön,doku-serie|Our Planet
s|Love Is Blind|2020|Reality,Romantik|dating,trash,liebe
s|Too Hot to Handle|2020|Reality,Romantik|dating,trash,urlaub
s|Queer Eye|2018|Reality|wohlfühl,herzlich,makeover
s|Selling Sunset|2019|Reality|reiche,immobilien,trash,drama
s|The Great British Bake Off|2010|Reality|backen,wohlfühl,britisch,wettbewerb
s|Monk|2002|Krimi,Komödie|detektiv,episodisch,wohlfühl,skurril,leicht
s|Castle|2009|Krimi,Komödie,Romantik|ermittler,episodisch,leicht,schriftsteller,liebe
s|Lucifer|2016|Fantasy,Krimi,Komödie|übernatürlich,teufel,episodisch,leicht,comicvorlage
s|Bones|2005|Krimi,Drama|forensik,episodisch,leicht,team|Bones – Die Knochenjägerin
s|Criminal Minds|2005|Krimi,Thriller|fbi,serienkiller,episodisch,profiler
s|Lupin|2021|Krimi,Thriller,Abenteuer|meisterdieb,französisch,heist,stilvoll,twist
s|Fleabag|2016|Komödie,Drama|britisch,frauen,schwarzer-humor,durchbrechen-der-wand,kurz-staffeln
s|Killing Eve|2018|Thriller,Komödie,Drama|spion,auftragsmörderin,britisch,katz-und-maus,schwarzer-humor
s|Russian Doll|2019|Komödie,Mystery,Drama|zeitschleife,new-york,skurril,kurz-staffeln|Matrjoschka
s|The Good Place|2016|Komödie,Fantasy|jenseits,philosophisch,lustig,twist,wohlfühl
s|Umbrella Academy|2019|Action,Sci-Fi,Komödie|superhelden,geschwister,zeitreise,skurril,comicvorlage|The Umbrella Academy
s|Locke & Key|2020|Fantasy,Horror,Mystery|magie,geschwister,familie,comicvorlage
s|Shadow and Bone|2021|Fantasy,Abenteuer|magie,romanvorlage,liebe,episch|Shadow and Bone – Legenden der Grisha
s|His Dark Materials|2019|Fantasy,Abenteuer|magie,parallelwelten,romanvorlage,britisch
s|Good Omens|2019|Fantasy,Komödie|engel,dämon,britisch,skurril,romanvorlage,freundschaft
s|Yellowstone|2018|Western,Drama|ranch,familie,macht,brutal,natur
s|Godless|2017|Western,Drama|miniserie,frauen,brutal,atmosphärisch
s|Mr. Robot|2015|Thriller,Drama|hacker,psychologie,twist,komplex,düster
s|Halt and Catch Fire|2014|Drama|80er,computer,charakterstudie,ruhig
s|The Leftovers|2014|Drama,Mystery,Fantasy|trauer,rätsel,gefühlvoll,komplex,romanvorlage
s|Six Feet Under|2001|Drama,Komödie|bestatter,familie,tod,charakterstudie,schwarzer-humor
s|The Wire|2002|Krimi,Drama|polizei,drogen,gesellschaftskritik,komplex,kult
s|Kaos|2024|Komödie,Fantasy|griechische-götter,skurril,schwarzer-humor,britisch
s|Shrinking|2023|Komödie,Drama|trauer,therapie,herzlich,wohlfühl,lustig
s|Hacks|2021|Komödie,Drama|comedy-welt,frauen,generationen,lustig
s|Only Fools and Horses|1981|Komödie|sitcom,britisch,kult
s|Kingdom|2019|Horror,Historie,Thriller|koreanisch,zombies,joseon,kostüm,spannend
s|Crash Landing on You|2019|Romantik,Komödie,Drama|koreanisch,k-drama,liebe,nordkorea,herzlich|Crash Landing on You
s|Extraordinary Attorney Woo|2022|Drama,Komödie|koreanisch,k-drama,anwalt,autismus,herzlich,wohlfühl
s|Blue Eye Samurai|2023|Animation,Action|japan,samurai,rache,erwachsenen-animation,brutal,stilvoll
s|Bluey|2018|Animation,Familie,Komödie|kinder,familie,herzlich,wohlfühl,kurz-folgen
f|Inception|2010|Sci-Fi,Action,Thriller|träume,komplex,heist,twist,nolan,episch
f|Interstellar|2014|Sci-Fi,Drama,Abenteuer|weltraum,zeit,vater-tochter,gefühlvoll,nolan,episch
f|The Dark Knight|2008|Action,Krimi,Drama|superhelden,dc,batman,düster,nolan,kult|The Dark Knight
f|Oppenheimer|2023|Drama,Historie|wahre-geschichte,wissenschaft,zweiter-weltkrieg,nolan,biografie,episch
f|Tenet|2020|Sci-Fi,Action,Thriller|zeit,spion,komplex,nolan
f|Memento|2000|Thriller,Mystery|gedächtnis,rückwärts-erzählt,twist,nolan,komplex
f|Prestige – Die Meister der Magie|2006|Mystery,Drama,Thriller|zauberer,rivalen,twist,nolan,historie|The Prestige
f|Shutter Island|2010|Thriller,Mystery|psychiatrie,twist,düster,romanvorlage
f|Fight Club|1999|Drama,Thriller|twist,gesellschaftskritik,kult,düster
f|Sieben|1995|Krimi,Thriller,Mystery|serienkiller,ermittler,düster,twist,kult|Se7en
f|Das Schweigen der Lämmer|1991|Thriller,Krimi,Horror|serienkiller,fbi,psychologie,kult,romanvorlage|The Silence of the Lambs
f|Gone Girl|2014|Thriller,Mystery,Drama|ehe,twist,psychologie,romanvorlage,düster|Gone Girl – Das perfekte Opfer
f|Prisoners|2013|Thriller,Krimi,Drama|entführung,düster,ermittler,spannend,vater
f|Zodiac|2007|Krimi,Thriller,Mystery|serienkiller,wahre-geschichte,ermittler,ruhig|Zodiac – Die Spur des Killers
f|Knives Out|2019|Krimi,Komödie,Mystery|whodunit,familie,clever,lustig,reiche|Knives Out – Mord ist Familiensache
f|Parasite|2019|Thriller,Drama,Komödie|koreanisch,arm-und-reich,gesellschaftskritik,twist,schwarzer-humor
f|Get Out|2017|Horror,Thriller,Mystery|rassismus,gesellschaftskritik,twist,spannend
f|Hereditary|2018|Horror,Drama,Mystery|familie,trauer,übernatürlich,düster,verstörend|Hereditary – Das Vermächtnis
f|Conjuring – Die Heimsuchung|2013|Horror,Mystery|geister,dämonen,wahre-geschichte,spannend|The Conjuring
f|Es|2017|Horror,Fantasy|clown,teenager,freundschaft,kleinstadt,romanvorlage,stephen-king|It
f|A Quiet Place|2018|Horror,Sci-Fi,Drama|monster,familie,stille,spannend,überleben
f|Shining|1980|Horror,Mystery|hotel,wahnsinn,kult,romanvorlage,stephen-king|The Shining
f|Scream|1996|Horror,Mystery|slasher,teenager,whodunit,kult,meta
f|Alien|1979|Sci-Fi,Horror|weltraum,monster,kult,spannend|Alien – Das unheimliche Wesen aus einer fremden Welt
f|Der Exorzist|1973|Horror|dämonen,besessenheit,kult,verstörend|The Exorcist
f|Matrix|1999|Sci-Fi,Action|simulation,ki,kult,philosophisch,kampf|The Matrix
f|Blade Runner 2049|2017|Sci-Fi,Drama,Mystery|ki,dystopie,atmosphärisch,ruhig,stilvoll
f|Dune|2021|Sci-Fi,Abenteuer,Drama|wüste,episch,romanvorlage,politik,stilvoll|Dune: Part One
f|Dune: Part Two|2024|Sci-Fi,Abenteuer,Action|wüste,episch,romanvorlage,politik,stilvoll|Dune: Part Two
f|Arrival|2016|Sci-Fi,Drama,Mystery|aliens,sprache,gefühlvoll,ruhig,twist
f|Der Marsianer|2015|Sci-Fi,Abenteuer,Drama|weltraum,überleben,lustig,wissenschaft,romanvorlage|The Martian
f|Gravity|2013|Sci-Fi,Thriller|weltraum,überleben,spannend
f|Ex Machina|2014|Sci-Fi,Thriller,Drama|ki,kammerspiel,twist,philosophisch
f|Everything Everywhere All at Once|2022|Sci-Fi,Komödie,Action|parallelwelten,mutter-tochter,skurril,gefühlvoll,kampf
f|Zurück in die Zukunft|1985|Sci-Fi,Abenteuer,Komödie|zeitreise,80er,kult,familie,lustig|Back to the Future
f|E.T. – Der Außerirdische|1982|Sci-Fi,Familie,Abenteuer|aliens,kinder,freundschaft,kult,gefühlvoll|E.T. the Extra-Terrestrial
f|Jurassic Park|1993|Abenteuer,Sci-Fi,Action|dinosaurier,kult,spannend,romanvorlage
f|Avatar – Aufbruch nach Pandora|2009|Sci-Fi,Abenteuer,Action|aliens,natur,episch,bildgewaltig|Avatar
f|Star Wars: Eine neue Hoffnung|1977|Sci-Fi,Abenteuer,Fantasy|star-wars,weltraum,kult,episch|Star Wars
f|Der Herr der Ringe: Die Gefährten|2001|Fantasy,Abenteuer|episch,magie,reise,freundschaft,romanvorlage,kult|The Lord of the Rings: The Fellowship of the Ring
f|Der Hobbit: Eine unerwartete Reise|2012|Fantasy,Abenteuer|magie,reise,drachen,romanvorlage|The Hobbit: An Unexpected Journey
f|Harry Potter und der Stein der Weisen|2001|Fantasy,Familie,Abenteuer|magie,schule,freundschaft,romanvorlage,kult|Harry Potter and the Philosopher's Stone
f|Phantastische Tierwesen und wo sie zu finden sind|2016|Fantasy,Abenteuer,Familie|magie,tiere,20er,new-york|Fantastic Beasts and Where to Find Them
f|Fluch der Karibik|2003|Abenteuer,Fantasy,Action|piraten,lustig,kult,schatz|Pirates of the Caribbean: The Curse of the Black Pearl
f|Indiana Jones – Jäger des verlorenen Schatzes|1981|Abenteuer,Action|schatz,archäologie,kult,lustig|Raiders of the Lost Ark
f|Avengers: Endgame|2019|Action,Sci-Fi,Abenteuer|superhelden,marvel,episch,team,finale
f|Guardians of the Galaxy|2014|Action,Sci-Fi,Komödie|superhelden,marvel,weltraum,lustig,team,musik-80er
f|Spider-Man: No Way Home|2021|Action,Abenteuer,Sci-Fi|superhelden,marvel,parallelwelten,teenager
f|Spider-Man: A New Universe|2018|Animation,Action,Abenteuer|superhelden,parallelwelten,stilvoll,coming-of-age|Spider-Man: Into the Spider-Verse
f|Black Panther|2018|Action,Abenteuer,Sci-Fi|superhelden,marvel,afrika,politik
f|Deadpool|2016|Action,Komödie|superhelden,marvel,schwarzer-humor,durchbrechen-der-wand,brutal
f|Joker|2019|Drama,Krimi,Thriller|dc,psychologie,gesellschaftskritik,düster,charakterstudie
f|The Batman|2022|Krimi,Action,Mystery|superhelden,dc,batman,detektiv,düster
f|Mad Max: Fury Road|2015|Action,Abenteuer,Sci-Fi|endzeit,verfolgungsjagd,wüste,bildgewaltig
f|John Wick|2014|Action,Thriller,Krimi|rache,auftragsmörder,kampf,stilvoll
f|Mission: Impossible – Fallout|2018|Action,Thriller|spion,stunts,spannend|Mission: Impossible – Fallout
f|Top Gun: Maverick|2022|Action,Drama|piloten,militär,spannend,fortsetzung
f|James Bond 007: Casino Royale|2006|Action,Thriller|spion,bond,britisch,stilvoll|Casino Royale
f|Stirb langsam|1988|Action,Thriller|weihnachten,geiseln,kult,80er|Die Hard
f|Heat|1995|Krimi,Thriller,Action|heist,polizei,gangster,kult
f|Ocean's Eleven|2001|Krimi,Komödie,Thriller|heist,team,stilvoll,leicht,las-vegas
f|Baby Driver|2017|Action,Krimi,Musik|heist,verfolgungsjagd,musik,stilvoll
f|Der Pate|1972|Krimi,Drama|mafia,familie,kult,episch,romanvorlage|The Godfather
f|GoodFellas|1990|Krimi,Drama|mafia,wahre-geschichte,kult,brutal|Goodfellas – Drei Jahrzehnte in der Mafia
f|The Wolf of Wall Street|2013|Komödie,Krimi,Drama|börse,exzess,wahre-geschichte,schwarzer-humor
f|Pulp Fiction|1994|Krimi,Thriller,Komödie|gangster,kult,nicht-chronologisch,tarantino,schwarzer-humor
f|Inglourious Basterds|2009|Krieg,Drama,Action|zweiter-weltkrieg,rache,tarantino,schwarzer-humor
f|Django Unchained|2012|Western,Drama,Action|sklaverei,rache,tarantino,brutal
f|Kill Bill: Volume 1|2003|Action,Krimi,Thriller|rache,kampf,tarantino,stilvoll
f|Gladiator|2000|Action,Drama,Historie|rom,rache,episch,kampf,kult
f|Braveheart|1995|Historie,Drama,Krieg|schottland,mittelalter,episch,freiheit
f|Der Soldat James Ryan|1998|Krieg,Drama|zweiter-weltkrieg,episch,brutal|Saving Private Ryan
f|1917|2019|Krieg,Drama,Thriller|erster-weltkrieg,plansequenz,spannend
f|Im Westen nichts Neues|2022|Krieg,Drama|erster-weltkrieg,deutsch,romanvorlage,düster,brutal
f|Dunkirk|2017|Krieg,Historie,Thriller|zweiter-weltkrieg,nolan,spannend,wahre-geschichte
f|Schindlers Liste|1993|Drama,Historie,Krieg|holocaust,wahre-geschichte,ernst,tränen|Schindler's List
f|Das Leben der Anderen|2006|Drama,Thriller|ddr,stasi,deutsch,ruhig,gefühlvoll
f|Good Bye, Lenin!|2003|Komödie,Drama|ddr,deutsch,familie,herzlich,berlin
f|Lola rennt|1998|Thriller,Action|deutsch,berlin,zeitschleife,kult,stilvoll
f|Der Untergang|2004|Drama,Historie,Krieg|zweiter-weltkrieg,deutsch,berlin,wahre-geschichte
f|Das Experiment|2001|Thriller,Drama|deutsch,psychologie,gefängnis,düster
f|Systemsprenger|2019|Drama|deutsch,kind,jugendhilfe,intensiv,tränen
f|Fack ju Göhte|2013|Komödie|deutsch,schule,lustig,leicht
f|Honig im Kopf|2014|Komödie,Drama,Familie|deutsch,demenz,großvater,roadtrip,gefühlvoll
f|Ziemlich beste Freunde|2011|Komödie,Drama|französisch,freundschaft,wahre-geschichte,herzlich,wohlfühl|Intouchables
f|Die fabelhafte Welt der Amélie|2001|Romantik,Komödie|französisch,paris,verträumt,wohlfühl,stilvoll|Le Fabuleux Destin d'Amélie Poulain
f|Willkommen bei den Sch'tis|2008|Komödie|französisch,lustig,wohlfühl,provinz|Bienvenue chez les Ch'tis
f|Forrest Gump|1994|Drama,Romantik,Komödie|lebensgeschichte,kult,gefühlvoll,herzlich,romanvorlage
f|Die Verurteilten|1994|Drama,Krimi|gefängnis,freundschaft,hoffnung,kult,romanvorlage,stephen-king|The Shawshank Redemption
f|The Green Mile|1999|Drama,Fantasy,Krimi|gefängnis,übernatürlich,tränen,romanvorlage,stephen-king
f|Titanic|1997|Romantik,Drama,Historie|liebe,katastrophe,kult,tränen,episch
f|Pretty Woman|1990|Romantik,Komödie|liebe,reiche,kult,leicht
f|Notting Hill|1999|Romantik,Komödie|liebe,britisch,berühmtheit,wohlfühl
f|Tatsächlich … Liebe|2003|Romantik,Komödie,Drama|weihnachten,britisch,episodenfilm,wohlfühl,liebe|Love Actually
f|Wie ein einziger Tag|2004|Romantik,Drama|liebe,tränen,romanvorlage,zwei-zeitebenen|The Notebook
f|Ein ganzes halbes Jahr|2016|Romantik,Drama|liebe,tränen,britisch,romanvorlage|Me Before You
f|Das Schicksal ist ein mieser Verräter|2014|Romantik,Drama|teenager,krankheit,liebe,tränen,romanvorlage|The Fault in Our Stars
f|La La Land|2016|Musik,Romantik,Drama|musical,los-angeles,träume,stilvoll,bittersüß
f|Crazy, Stupid, Love|2011|Komödie,Romantik,Drama|liebe,familie,leicht,twist
f|Selbst ist die Braut|2009|Komödie,Romantik|liebe,büro,leicht,wohlfühl|The Proposal
f|Plötzlich Prinzessin|2001|Komödie,Familie,Romantik|teenager,königshaus,wohlfühl,leicht|The Princess Diaries
f|Der Teufel trägt Prada|2006|Komödie,Drama|mode,new-york,arbeit,stilvoll,romanvorlage|The Devil Wears Prada
f|Natürlich blond|2001|Komödie,Romantik|anwalt,frauen,wohlfühl,lustig|Legally Blonde
f|Girls Club – Vorsicht bissig!|2004|Komödie|teenager,schule,kult,lustig|Mean Girls
f|10 Dinge, die ich an dir hasse|1999|Komödie,Romantik|teenager,schule,liebe,90er,kult|10 Things I Hate About You
f|Barbie|2023|Komödie,Fantasy|satire,frauen,bunt,lustig,gesellschaftskritik
f|Brautalarm|2011|Komödie|hochzeit,freundinnen,lustig,fremdscham|Bridesmaids
f|Hangover|2009|Komödie|männer,party,las-vegas,lustig,chaos|The Hangover
f|Superbad|2007|Komödie|teenager,party,lustig,freundschaft
f|Grand Budapest Hotel|2014|Komödie,Abenteuer,Krimi|wes-anderson,skurril,stilvoll,hotel|The Grand Budapest Hotel
f|Die Truman Show|1998|Drama,Komödie,Sci-Fi|reality-tv,überwachung,philosophisch,gefühlvoll|The Truman Show
f|Täglich grüßt das Murmeltier|1993|Komödie,Fantasy,Romantik|zeitschleife,kult,lustig,wohlfühl|Groundhog Day
f|Vergiss mein nicht!|2004|Romantik,Sci-Fi,Drama|erinnerung,liebe,nicht-chronologisch,bittersüß|Eternal Sunshine of the Spotless Mind
f|Her|2013|Romantik,Sci-Fi,Drama|ki,liebe,einsamkeit,ruhig,bittersüß
f|Whiplash|2014|Drama,Musik|jazz,besessenheit,intensiv,lehrer
f|Bohemian Rhapsody|2018|Musik,Drama|queen,biografie,wahre-geschichte,konzert
f|Rocketman|2019|Musik,Drama|biografie,musical,elton-john,bunt
f|Mamma Mia!|2008|Musik,Komödie,Romantik|musical,abba,griechenland,wohlfühl,sommer
f|Greatest Showman|2017|Musik,Drama|musical,zirkus,wohlfühl,bunt|The Greatest Showman
f|A Star Is Born|2018|Musik,Romantik,Drama|liebe,ruhm,sucht,tränen
f|Pitch Perfect|2012|Musik,Komödie|a-cappella,college,lustig,wohlfühl
f|Rocky|1976|Sport,Drama|boxen,underdog,kult,motivation
f|Creed|2015|Sport,Drama|boxen,underdog,fortsetzung|Creed – Rocky's Legacy
f|Rush – Alles für den Sieg|2013|Sport,Drama|formel-1,rivalen,wahre-geschichte,spannend|Rush
f|Le Mans 66 – Gegen jede Chance|2019|Sport,Drama|autorennen,wahre-geschichte,freundschaft|Ford v Ferrari
f|Moneyball|2011|Sport,Drama|baseball,wahre-geschichte,zahlen,ruhig|Die Kunst zu gewinnen – Moneyball
f|Catch Me If You Can|2002|Krimi,Drama,Komödie|betrüger,wahre-geschichte,katz-und-maus,leicht,60er
f|The Social Network|2010|Drama|facebook,wahre-geschichte,schnell-geredet,freundschaft,startup
f|The Big Short|2015|Komödie,Drama|finanzkrise,wahre-geschichte,schwarzer-humor,börse
f|Spotlight|2015|Drama,Krimi|journalismus,wahre-geschichte,kirche,ernst
f|Hidden Figures|2016|Drama,Historie|nasa,frauen,rassismus,wahre-geschichte,motivation|Hidden Figures – Unerkannte Heldinnen
f|Green Book|2018|Drama,Komödie|roadtrip,rassismus,freundschaft,wahre-geschichte,herzlich|Green Book – Eine besondere Freundschaft
f|12 Years a Slave|2013|Drama,Historie|sklaverei,wahre-geschichte,ernst,brutal
f|A Beautiful Mind|2001|Drama|mathematik,schizophrenie,wahre-geschichte,twist|A Beautiful Mind – Genie und Wahnsinn
f|Good Will Hunting|1997|Drama|genie,therapie,freundschaft,gefühlvoll
f|Der Club der toten Dichter|1989|Drama|schule,lehrer,poesie,tränen,kult|Dead Poets Society
f|Das Streben nach Glück|2006|Drama|vater-sohn,armut,wahre-geschichte,motivation,tränen|The Pursuit of Happyness
f|Into the Wild|2007|Abenteuer,Drama|natur,alaska,aussteiger,wahre-geschichte,roadtrip|Into the Wild
f|The Revenant|2015|Abenteuer,Drama,Western|natur,überleben,rache,brutal,bildgewaltig|The Revenant – Der Rückkehrer
f|Cast Away|2000|Abenteuer,Drama|insel,überleben,einsamkeit|Cast Away – Verschollen
f|Life of Pi|2012|Abenteuer,Drama,Fantasy|meer,tiger,überleben,bildgewaltig,romanvorlage|Life of Pi – Schiffbruch mit Tiger
f|Das erstaunliche Leben des Walter Mitty|2013|Abenteuer,Komödie,Drama|reise,träumer,island,wohlfühl,bildgewaltig|The Secret Life of Walter Mitty
f|No Country for Old Men|2007|Krimi,Thriller,Western|killer,wüste,düster,romanvorlage
f|Drive|2011|Krimi,Thriller,Drama|fahrer,stilvoll,ruhig,brutal
f|Nightcrawler|2014|Thriller,Krimi,Drama|journalismus,psychologie,düster,antiheld|Nightcrawler – Jede Nacht hat ihren Preis
f|Der Pianist|2002|Drama,Krieg,Historie|zweiter-weltkrieg,holocaust,musik,wahre-geschichte|The Pianist
f|Toy Story|1995|Animation,Familie,Komödie|pixar,spielzeug,freundschaft,kult,wohlfühl
f|Findet Nemo|2003|Animation,Familie,Abenteuer|pixar,meer,vater-sohn,wohlfühl|Finding Nemo
f|Oben|2009|Animation,Familie,Abenteuer|pixar,alter,reise,tränen,herzlich|Up
f|Alles steht Kopf|2015|Animation,Familie,Komödie|pixar,gefühle,teenager,herzlich,clever|Inside Out
f|Coco – Lebendiger als das Leben!|2017|Animation,Familie,Musik|pixar,mexiko,familie,jenseits,tränen|Coco
f|Ratatouille|2007|Animation,Familie,Komödie|pixar,kochen,paris,wohlfühl
f|WALL·E – Der Letzte räumt die Erde auf|2008|Animation,Sci-Fi,Familie|pixar,roboter,umwelt,liebe,ruhig|WALL-E
f|Die Monster AG|2001|Animation,Familie,Komödie|pixar,monster,kinder,lustig,freundschaft|Monsters, Inc.
f|Die Unglaublichen|2004|Animation,Action,Familie|pixar,superhelden,familie,lustig|The Incredibles
f|Der König der Löwen|1994|Animation,Familie,Musik|disney,tiere,afrika,kult,tränen|The Lion King
f|Die Eiskönigin – Völlig unverfroren|2013|Animation,Familie,Musik|disney,schwestern,magie,musical|Frozen
f|Rapunzel – Neu verföhnt|2010|Animation,Familie,Romantik|disney,märchen,musical,lustig|Tangled
f|Vaiana|2016|Animation,Abenteuer,Musik|disney,meer,reise,musical|Moana
f|Encanto|2021|Animation,Familie,Musik|disney,kolumbien,familie,magie,musical
f|Shrek – Der tollkühne Held|2001|Animation,Komödie,Familie|märchen-parodie,lustig,kult,freundschaft|Shrek
f|Drachenzähmen leicht gemacht|2010|Animation,Abenteuer,Familie|drachen,freundschaft,wikinger,herzlich|How to Train Your Dragon
f|Chihiros Reise ins Zauberland|2001|Animation,Fantasy,Familie|anime,ghibli,magie,verträumt,kult|Spirited Away
f|Mein Nachbar Totoro|1988|Animation,Fantasy,Familie|anime,ghibli,kinder,wohlfühl,ruhig|My Neighbor Totoro
f|Your Name.|2016|Animation,Romantik,Fantasy|anime,körpertausch,zeit,gefühlvoll,bildgewaltig|Your Name. – Gestern, heute und für immer
f|Paddington 2|2017|Familie,Komödie,Abenteuer|bär,britisch,wohlfühl,herzlich,lustig
f|Wonka|2023|Familie,Fantasy,Musik|schokolade,musical,wohlfühl,bunt
f|Kevin – Allein zu Haus|1990|Komödie,Familie|weihnachten,kinder,kult,lustig|Home Alone
f|Der Grinch|2000|Komödie,Familie,Fantasy|weihnachten,lustig,märchen|How the Grinch Stole Christmas
f|Drei Haselnüsse für Aschenbrödel|1973|Fantasy,Romantik,Familie|weihnachten,märchen,kult,wohlfühl,tschechisch
f|Wicked|2024|Musik,Fantasy,Romantik|musical,magie,freundinnen,bunt|Wicked
f|Poor Things|2023|Komödie,Sci-Fi,Romantik|skurril,frauen,stilvoll,surreal
f|Gone in 60 Seconds|2000|Action,Krimi|autos,heist|Nur noch 60 Sekunden
f|Fast & Furious|2001|Action,Krimi|autos,rennen,familie,team|The Fast and the Furious
f|Top Secret!|1984|Komödie|parodie,kult,albern
f|Die nackte Kanone|1988|Komödie,Krimi|parodie,kult,albern,polizei|The Naked Gun
f|Ich – Einfach unverbesserlich|2010|Animation,Komödie,Familie|minions,lustig,familie|Despicable Me
f|Der Schuh des Manitu|2001|Komödie,Western|deutsch,parodie,kult,albern
f|Contagion|2011|Thriller,Drama,Sci-Fi|pandemie,wissenschaft,realistisch
f|Don't Look Up|2021|Komödie,Sci-Fi,Drama|satire,komet,politik,schwarzer-humor
f|Glass Onion|2022|Krimi,Komödie,Mystery|whodunit,reiche,insel,clever,lustig|Glass Onion: A Knives Out Mystery
f|Mord im Orient-Express|2017|Krimi,Mystery,Drama|whodunit,zug,romanvorlage,agatha-christie|Murder on the Orient Express
f|Der Name der Rose|1986|Krimi,Mystery,Historie|kloster,mittelalter,romanvorlage,whodunit,düster
f|Das Parfum – Die Geschichte eines Mörders|2006|Krimi,Drama,Fantasy|deutsch,romanvorlage,historie,düster,kostüm|Perfume: The Story of a Murderer
f|Gefährliche Brandung|1991|Action,Krimi|surfen,undercover,heist,90er|Point Break
f|Sicario|2015|Thriller,Krimi,Action|drogen,mexiko,düster,spannend
f|Wind River|2017|Krimi,Thriller,Drama|schnee,reservat,whodunit,düster
f|Gone Baby Gone|2007|Krimi,Drama,Mystery|entführung,ermittler,moral,romanvorlage|Gone Baby Gone – Kein Kinderspiel
f|Smile|2022|Horror,Mystery|fluch,psychologie,spannend|Smile – Siehst du es auch?
f|Talk to Me|2022|Horror,Thriller|geister,teenager,spannend
f|Barbarian|2022|Horror,Thriller|haus,twist,verstörend
f|Saltburn|2023|Thriller,Drama,Komödie|reiche,britisch,obsession,schwarzer-humor,twist
f|Anatomie eines Falls|2023|Drama,Krimi|gericht,ehe,französisch,ruhig|Anatomie d'une chute
f|The Holdovers|2023|Komödie,Drama|weihnachten,lehrer,internat,70er,herzlich,bittersüß
f|Past Lives|2023|Romantik,Drama|liebe,koreanisch,bittersüß,ruhig|Past Lives – In einem anderen Leben
f|Killers of the Flower Moon|2023|Krimi,Drama,Western|wahre-geschichte,ureinwohner,episch,scorsese
`;

// Eindeutige ID aus Titel + Jahr (gleich gebildet für Katalog und Online-Treffer, damit nichts doppelt auftaucht)
export function makeId(type, title, year) {
  const base = String(title).toLowerCase()
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${type}-${base}-${year || ""}`;
}

const seen = new Set();
export const CATALOG = RAW.trim().split("\n").map(line => {
  const [type, title, year, genres, tags, orig] = line.split("|");
  return {
    id: makeId(type, title, year), type, title, year: Number(year) || null,
    genres: genres.split(",").map(g => g.trim()).filter(g => GENRES.includes(g)),
    tags: (tags || "").split(",").map(t => t.trim()).filter(Boolean),
    orig: orig && orig !== title ? orig : "",
    src: "katalog"
  };
}).filter(x => !seen.has(x.id) && seen.add(x.id));

export const CATALOG_BY_ID = new Map(CATALOG.map(x => [x.id, x]));

// Schöne Namen für die Merkmale (nur die, die man nicht direkt versteht)
export const TAG_LABEL = {
  "wahre-geschichte": "wahre Geschichte", "romanvorlage": "nach einem Buch", "comicvorlage": "nach einem Comic",
  "spielvorlage": "nach einem Videospiel", "mangavorlage": "nach einem Manga", "kurz-staffeln": "kurze Staffeln",
  "kurz-folgen": "kurze Folgen", "miniserie": "Miniserie", "schwarzer-humor": "schwarzer Humor",
  "erwachsenen-animation": "Animation für Erwachsene", "zwei-zeitebenen": "zwei Zeitebenen", "k-drama": "K-Drama",
  "doku-serie": "Doku-Serie", "durchbrechen-der-wand": "spricht mit dem Publikum", "nicht-chronologisch": "nicht der Reihe nach erzählt",
  "familiengeheimnis": "Familiengeheimnis", "gesellschaftskritik": "Gesellschaftskritik", "charakterstudie": "Charakterstudie",
  "katz-und-maus": "Katz und Maus", "arm-und-reich": "Arm und Reich", "true-crime": "True Crime", "sitcom-parodie": "Sitcom-Parodie"
};
export const tagLabel = t => TAG_LABEL[t] || t.replace(/-/g, " ");
