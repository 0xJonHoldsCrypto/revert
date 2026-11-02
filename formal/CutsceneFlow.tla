---- MODULE CutsceneFlow ----
EXTENDS Naturals

VARIABLES cutscene, bossIndex, bannerShown

Cutscenes == {"none", "boss_intro", "victory", "defeat"}

Init ==
  /\\ cutscene = "none"
  /\\ bossIndex = 0
  /\\ bannerShown = FALSE

ShowBossIntro ==
  /\\ cutscene = "none"
  /\\ bossIndex < 4
  /\\ cutscene' = "boss_intro"
  /\\ bannerShown' = TRUE
  /\\ bossIndex' = bossIndex + 1
  /\\ UNCHANGED <<>>

ClearIntro ==
  /\\ cutscene = "boss_intro"
  /\\ cutscene' = "none"
  /\\ UNCHANGED <<bossIndex, bannerShown>>

Victory ==
  /\\ cutscene = "none"
  /\\ cutscene' = "victory"
  /\\ UNCHANGED <<bossIndex, bannerShown>>

Defeat ==
  /\\ cutscene = "none"
  /\\ cutscene' = "defeat"
  /\\ UNCHANGED <<bossIndex, bannerShown>>

Next ==
  \\/ ShowBossIntro
  \\/ ClearIntro
  \\/ Victory
  \\/ Defeat

Spec == Init /\\ [][Next]_<<cutscene, bossIndex, bannerShown>>
====
