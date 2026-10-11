import {test} from 'node:test';
import assert from 'node:assert/strict';
import {socialLinks} from '../src/lib/social-links.ts';
import {blank,basic,parseCard,vcard,fields} from '../src/lib/people.ts';

test('social links use readable names and open the exact saved HTTP or HTTPS address',()=>{
 const person={...blank(),first:'Sara',linkedin:'https://linkedin.com/in/sara',instagram:'https://instagram.com/sara',other:'https://facebook.com/sara',otherLabel:'Facebook'};
 assert.deepEqual(socialLinks(person).map(link=>[link.label,link.href]),[['LinkedIn',person.linkedin],['Instagram',person.instagram],['Facebook',person.other]]);
 assert.equal(socialLinks({...person,otherLabel:''})[2].label,'Sito / altro profilo');
 assert.equal(socialLinks({...person,otherLabel:'Profilo'})[2].custom,true);
 assert.equal(socialLinks({...person,other:'javascript:alert(1)',linkedin:'data:text/html,unsafe',instagram:'invalid-url'}).length,0);
});

test('link names survive essentials and vCard round-trips while private notes stay excluded',()=>{
 const person={...blank(),first:'Sara',other:'https://example.com',otherLabel:'Sito personale; progetti',notes:'Private note',usefulness:'Private context'};
 const essentials=basic(person);assert.equal(essentials.otherLabel,person.otherLabel);assert.equal(essentials.notes,undefined);
 const card=vcard(essentials),parsed=parseCard(card).person;assert.equal(parsed.other,new URL(person.other).href);assert.equal(parsed.otherLabel,person.otherLabel);assert.ok(!card.includes('Private note'));assert.ok(!card.includes('Private context'));
 assert.equal(fields.parse({first:'Old contact'}).otherLabel,'');
 assert.equal(fields.safeParse({...person,otherLabel:'x'.repeat(121)}).success,false);
});
