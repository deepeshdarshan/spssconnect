/**
 * @fileoverview Reads the registration form into the Firestore document shape.
 * @module form/form-handler-data
 */

/**
 * Reads all form fields and returns the structured document data.
 * Uses element IDs directly — no name attributes needed for the house owner.
 * @returns {Object} The form data matching the Firestore schema.
 */
export function collectFormData() {
  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || 'false';

  const holdsPosition = val('holdsSpssPosition') === 'yes';

  const personalDetails = {
    name: val('ownerName'),
    dob: val('ownerDOB'),
    houseName: val('houseName'),
    gender: val('ownerGender'),
    pradeshikaSabha: val('pradeshikaSabha') || val('pradeshikaSabhaHidden'),
    photoURL: '',
    bloodGroup: val('ownerBloodGroup'),
    occupation: val('ownerOccupation'),
    areaOfExpertise: val('ownerOccupation') ? val('ownerExpertise') : '',
    phone: val('ownerPhone'),
    email: val('ownerEmail'),
    membershipType: val('ownerMembership'),
    highestEducation: val('ownerEducation'),
    address: {
      address1: val('address1'),
      address2: val('address2'),
      place: val('place'),
      pin: val('pin'),
    },
    holdsSpssPosition: holdsPosition,
    spssPositionName: holdsPosition ? val('spssPositionName') : '',
    healthInsurance: radio('healthInsurance') === 'true',
    termLifeInsurance: radio('termLifeInsurance') === 'true',
    rationCardType: val('rationCardType'),
  };

  const members = collectDynamicEntries('membersContainer', 'member', false);
  const nonMembers = collectDynamicEntries('nonMembersContainer', 'nonMember', true);

  return { personalDetails, members, nonMembers };
}

/**
 * Collects data from dynamic member/non-member blocks.
 * @param {string} containerId
 * @param {string} prefix
 * @param {boolean} [isNonMember=false]
 * @returns {Array<Object>}
 */
function collectDynamicEntries(containerId, prefix, isNonMember = false) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  const blocks = container.querySelectorAll('.dynamic-block');
  const entries = [];

  blocks.forEach((block) => {
    const idx = block.dataset.memberIndex || block.dataset.nonMemberIndex;
    const field = (name) => block.querySelector(`[name="${prefix}_${name}_${idx}"]`)?.value?.trim() || '';

    const holdsPosition = field('holdsSpssPosition') === 'yes';

    const livingOutside = field('livingOutside') === 'yes';

    const entry = {
      name: field('name'),
      dob: field('dob'),
      gender: field('gender'),
      relationship: field('relationship'),
      bloodGroup: field('blood'),
      phone: field('phone'),
      email: field('email'),
      highestEducation: field('education'),
      occupation: field('occupation'),
      areaOfExpertise: field('occupation') ? field('expertise') : '',
      livingOutsideKerala: livingOutside,
      outsideReason: livingOutside ? field('outsideReason') : '',
    };

    if (!isNonMember) {
      entry.membershipType = field('membership');
      entry.holdsSpssPosition = holdsPosition;
      entry.spssPositionName = holdsPosition ? field('spssPositionName') : '';
    }

    if (isNonMember) {
      entry.reasonForNoMembership = field('reason');
    }

    entries.push(entry);
  });

  return entries;
}
