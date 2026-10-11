import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callingCode,countryCodes,countryName,countryOptions,phoneCountries,resolveCountry,searchCountries,splitPhoneNumber,joinPhoneNumber} from '../src/lib/countries.ts';

test('country and calling-code lists cover countries and territories with localised names',()=>{
 assert.equal(new Set(countryCodes).size,countryCodes.length);
 assert.ok(countryCodes.length>=250);
 assert.ok(phoneCountries.length>=240);
 for(const code of ['IT','US','CA','CN','IN','GB','AQ','XK','PS','VA','EH'])assert.ok(countryCodes.includes(code));
 for(const code of phoneCountries)assert.match(callingCode(code),/^\+\d{1,3}$/);
 assert.equal(callingCode('IT'),'+39');
 assert.equal(callingCode('XK'),'+383');
 assert.equal(countryName('IT','it'),'Italia');
 assert.equal(countryName('IT','en'),'Italy');
 assert.equal(countryOptions('it').length,countryCodes.length);
});

test('country search highlights prefix matches, ignores accents and resolves existing names in either language',()=>{
 assert.equal(searchCountries(' ital ','it')[0].code,'IT');
 assert.equal(searchCountries('ital','en')[0].code,'IT');
 assert.equal(searchCountries('cote','en')[0].code,'CI');
 assert.equal(searchCountries('FR','it')[0].code,'FR');
 assert.equal(searchCountries('not-a-country','it').length,0);
 assert.equal(resolveCountry('Italia'),'IT');
 assert.equal(resolveCountry('Italy'),'IT');
 assert.equal(resolveCountry('USA'),'US');
 assert.equal(resolveCountry('UK'),'GB');
 assert.equal(resolveCountry('an old custom location'),undefined);
});

test('an empty new phone defaults to Italy without saving a bare calling code',()=>{
 assert.deepEqual(splitPhoneNumber(''),{country:'IT',national:''});
 assert.equal(joinPhoneNumber('IT',''),'');
 assert.equal(joinPhoneNumber('IT','333 1234567'),'+39 333 1234567');
 assert.deepEqual(splitPhoneNumber('333 1234567'),{country:'IT',national:'333 1234567'});
});

test('international numbers split once, preserve Italian leading zeros and support 00 prefixes and shared country codes',()=>{
 const cases=[['+39 02 12345678','IT','02 12345678'],['0039 02 12345678','IT','02 12345678'],['+44 20 7946 0958','GB','20 7946 0958'],['+1 416 555 1234','CA','416 555 1234'],['+1 213 373 4253','US','213 373 4253']];
 for(const [input,country,national]of cases){const parts=splitPhoneNumber(input);assert.deepEqual(parts,{country,national});assert.equal(joinPhoneNumber(parts.country,parts.national),callingCode(country)+' '+national);}
 const parts=splitPhoneNumber('+39 02 12345678 ext. 9');
 assert.equal(parts.national,'02 12345678 ext. 9');
 assert.equal(joinPhoneNumber(parts.country,parts.national),'+39 02 12345678 ext. 9');
});

test('unrecognised and non-geographic existing numbers remain intact',()=>{
 for(const value of ['+999 1234567','+800 12345678']){const parts=splitPhoneNumber(value);assert.deepEqual(parts,{country:'',national:value});assert.equal(joinPhoneNumber(parts.country,parts.national),value);}
});
