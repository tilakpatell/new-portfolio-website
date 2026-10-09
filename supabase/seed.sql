-- The planets a thing may be built on, and the places on them where nothing
-- may be. Written by scripts/supabase-seed.mjs from scripts/fixtures/planets.json; do not edit by hand.
-- Upserts, so it can be applied again after the list changes.

insert into public.planets (id, name, type, seed) values ('hoth', 'Hoth', 'ice', '1223795395') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('tatooine', 'Tatooine', 'desert', '8647508281676935542') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('endor', 'Endor', 'forest', '17936333477305376403') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('yavin', 'Yavin', 'jungle', '1927579065696738100') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('bespin', 'Bespin', 'gas', '5485698255689101500') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('mustafar', 'Mustafar', 'lava', '1127027023069150644') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('kamino', 'Kamino', 'ocean', '16829253035778520168') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('dagobah', 'Dagobah', 'swamp', '1702958522028571207') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:0', 'Lithialsur', 'gas', '9214131500749537690') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:1', 'Selimo', 'forest', '9214132600261165901') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:2', 'Ramsaex', 'lava', '9214129301726281268') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:3', 'Taecle', 'ice', '9214130401237909479') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:4', 'Taedixa', 'rock', '9214127102703024846') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:5', 'Deapho', 'ice', '9214128202214653057') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:0:6', 'Vaemalo', 'desert', '9214124903679768424') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:1:0', 'Miace', 'desert', '5034333057882641216') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:1:1', 'Seritiai', 'ocean', '5034334157394269427') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:1:2', 'Tephaemom', 'rock', '5034335256905897638') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:0', 'Cunano', 'gas', '9427996514885272807') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:1', 'Nole', 'ocean', '9427995415373644596') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:2', 'Niathia', 'rock', '9427998713908529229') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:3', 'Lesela', 'ringed', '9427997614396901018') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:4', 'Mipheselun', 'lava', '9427992116838759963') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:2:5', 'Cusnul', 'ice', '9427991017327131752') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:3:0', 'Riamseliacim', 'rock', '15974992389582672884') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:3:1', 'Seraeala', 'rock', '15974993489094301095') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:3:2', 'Siapho', 'forest', '15974994588605929306') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:4:0', 'Alissede', 'forest', '16154647539614666734') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:4:1', 'Viarae', 'rock', '16154648639126294945') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:4:2', 'Pheniamnal', 'ocean', '16154645340591410312') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:4:3', 'Rapho', 'gas', '16154646440103038523') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:4:4', 'Tasthu', 'gas', '16154651937661179578') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:4:5', 'Niaselabe', 'ice', '16154653037172807789') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:5:0', 'Thisax', 'ocean', '12669389782091427312') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:5:1', 'Liaclel', 'desert', '12669390881603055523') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:5:2', 'Seluserasera', 'lava', '12669391981114683734') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:5:3', 'Rothaesalal', 'desert', '12669393080626311945') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:5:4', 'Cuvaemi', 'ringed', '12669394180137940156') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:5:5', 'Aluxlo', 'ringed', '12669395279649568367') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:6:0', 'Vaeselil', 'desert', '11249089252094924317') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:6:1', 'Diserum', 'gas', '11249088152583296106') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:6:2', 'Themvi', 'ocean', '11249087053071667895') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:6:3', 'Tiame', 'gas', '11249085953560039684') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:6:4', 'Leina', 'ice', '11249084854048411473') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:6:5', 'Seraclibe', 'rock', '11249083754536783262') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:7:0', 'Sedavu', 'forest', '3908632022139464156') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:7:1', 'Cacia', 'gas', '3908633121651092367') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:7:2', 'Siasaeda', 'rock', '3908634221162720578') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:7:3', 'Diasur', 'rock', '3908635320674348789') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;
insert into public.planets (id, name, type, seed) values ('E:1,0:7:4', 'Vorselia', 'lava', '3908627624092951312') on conflict (id) do update set name = excluded.name, type = excluded.type, seed = excluded.seed;

insert into public.pois (id, planet_id, name, x, z, r) values ('hoth:echo-base', 'hoth', 'Echo Base', 1200, -800, 380) on conflict (id) do update set planet_id = excluded.planet_id, name = excluded.name, x = excluded.x, z = excluded.z, r = excluded.r;
