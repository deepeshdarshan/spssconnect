/**
 * @fileoverview English locale strings for the SPSS Connect data entry form.
 * @module locales/en
 */

const en = {
  // Page
  'page.title': 'Add New Record',
  'page.editTitle': 'Edit Record',

  // Sections
  'section.personalDetails': 'Personal Details (House Owner)',
  'section.address': 'Address',
  'section.healthFamily': 'Family',
  'section.members': 'Member Details',
  'section.nonMembers': 'Non-Member Details',

  // Form Labels
  'form.name': 'Name',
  'form.dob': 'Date of Birth',
  'form.gender': 'Gender',
  'form.houseName': 'House Name',
  'form.pradeshikaSabha': 'Pradeshika Sabha',
  'form.photo': 'Photo',
  'form.photoHint': 'Click or drag to upload photo',
  'form.bloodGroup': 'Blood Group',
  'form.occupation': 'Occupation',
  'form.membership': 'Membership',
  'form.education': 'Highest Education',
  'form.holdsSpssPosition': 'Do you hold any position in SPSS?',
  'form.spssPositionName': 'Position Name',
  'form.address1': 'Address Line 1',
  'form.address2': 'Address Line 2',
  'form.place': 'Place',
  'form.pin': 'PIN Code',
  'form.healthInsurance': 'Are all members covered under Health Insurance?',
  'form.familyOutside': 'Any family member living outside Kerala?',
  'form.outsideReason': 'Reason',
  'form.phone': 'Phone',
  'form.email': 'Email',
  'form.relationship': 'Relationship to House Owner',
  'form.reasonNoMembership': 'Reason for No Membership',
  'form.rationCardType': 'Ration Card Type',
  'form.selectOption': 'Select...',
  'form.noMembers': 'No members added yet. Click "Add Member" to begin.',
  'form.noNonMembers': 'No non-members added yet. Click "Add Non-Member" to begin.',

  // Options — Gender
  'option.male': 'Male',
  'option.female': 'Female',
  'option.other': 'Other',

  // Options — Yes/No
  'option.yes': 'Yes',
  'option.no': 'No',

  // Options — Ration Card Type
  'option.rationNone': 'No Ration Card',
  'option.rationWhite': 'White',
  'option.rationYellow': 'Yellow',
  'option.rationPink': 'Pink',

  // Options — Outside Reasons
  'option.work': 'Work',
  'option.study': 'Study',

  // Options — Occupation
  'option.govt': 'Government',
  'option.private': 'Private',
  'option.business': 'Business',
  'option.kazhakam': 'Kazhakam',
  'option.retired': 'Retired',
  'option.nonSalaried': 'Non Salaried',
  'option.student': 'Student',

  // Options — Membership
  'option.lifeMember': 'Life Member',
  'option.ordinaryMember': 'Ordinary Member',

  // Options — Education
  'option.below10th': 'Below 10th',
  'option.tenth': '10th',
  'option.plusTwo': 'Plus Two',
  'option.diploma': 'Diploma',
  'option.bachelors': "Bachelor's Degree",
  'option.masters': "Master's Degree",
  'option.doctorate': 'Doctorate',
  'option.professional': 'Professional',
  'option.otherEdu': 'Other',

  // Options — Pradeshika Sabha
  'option.ernakulam': 'Ernakulam',
  'option.edappally': 'Edappally',
  'option.tripunithura': 'Tripunithura',
  'option.chottanikkara': 'Chottanikkara',
  'option.perumbavoor': 'Perumbavoor',
  'option.aluva': 'Aluva',
  'option.panangad': 'Panangad',

  // Options — Relationship to House Owner
  'option.spouse': 'Spouse',
  'option.son': 'Son',
  'option.daughter': 'Daughter',
  'option.father': 'Father',
  'option.mother': 'Mother',
  'option.brother': 'Brother',
  'option.sister': 'Sister',
  'option.daughterInLaw': 'Daughter-in-law',
  'option.sonInLaw': 'Son-in-law',
  'option.grandchild': 'Grandchild',
  'option.otherRelation': 'Other',

  // Buttons
  'btn.submit': 'Save Record',
  'btn.update': 'Update Record',
  'btn.cancel': 'Cancel',
  'btn.addMember': 'Add Member',
  'btn.addNonMember': 'Add Non-Member',
  'btn.removeMember': 'Remove',

  // Dynamic Block
  'block.member': 'Member',
  'block.nonMember': 'Non-Member',

  // Validation
  'validation.nameRequired': 'Name is required',
  'validation.dobRequired': 'Date of birth is required',
  'validation.genderRequired': 'Gender is required',
  'validation.houseNameRequired': 'House name is required',
  'validation.sabhaRequired': 'Pradeshika Sabha is required',
  'validation.bloodGroupRequired': 'Blood group is required',
  'validation.occupationRequired': 'Occupation is required',
  'validation.membershipRequired': 'Membership type is required',
  'validation.educationRequired': 'Education is required',
  'validation.address1Required': 'Address Line 1 is required',
  'validation.address2Required': 'Address Line 2 is required',
  'validation.placeRequired': 'Place is required',
  'validation.pinInvalid': 'Enter a valid 6-digit PIN',
  'validation.phoneRequired': 'Phone number is required',
  'validation.phoneInvalid': 'Enter a valid 10-digit phone number',
  'validation.emailInvalid': 'Enter a valid email address',
  'validation.rationCardRequired': 'Ration card type is required',
  'validation.positionNameRequired': 'Please enter the position name',
  'validation.outsideReasonRequired': 'Please select a reason',
  'validation.required': 'This field is required',
  'validation.dobFuture': 'Date of birth cannot be in the future',

  // Messages
  'msg.saveSuccess': 'Record saved successfully!',
  'msg.updateSuccess': 'Record updated successfully!',
  'msg.deleteSuccess': 'Record deleted successfully!',
  'msg.saveFailed': 'Failed to save record. Please try again.',
  'msg.photoUploading': 'Uploading photo...',

  // Success Page
  'success.title': 'Thank You!',
  'success.message': 'Your record has been saved successfully.',
  'success.note': 'Please save the link below — you can use it anytime to view or update your information.',
  'success.urlLabel': 'Your Edit Link',
  'success.copy': 'Copy',
  'success.urlHint': 'Share this link only with people you trust.',
  'success.addAnother': 'Add Another Record',
  'success.goHome': 'Go Home',
};

export default en;
