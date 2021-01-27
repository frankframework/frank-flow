export default class GenerateInfoAttributesView {
    generatePipeAttributes(attributes) {
        if (attributes.x && attributes.y) {
          delete attributes.x;
          delete attributes.y;
        }

        for (let key in attributes) {
          if (key !== "name") {
            let attrWrapper = $('<div></div>').addClass('attributeWrapper'),
              attrLabel = $('<label></label>').text(key + ': ').addClass('forwardInfo'),
              deleteButton = $('<button></button>').text('Delete').attr({
                id: 'attributeDelete',
                name: key
              })
              .addClass('deleteButton'),
              attrInput = $('<input></input>').attr({
                type: 'input',
                name: key,
                id: 'attributeVal'
              }).val(attributes[key]);
    
            attrWrapper.append(attrLabel, attrInput, deleteButton);
            $('#attributesInfo').append(attrWrapper);
          }
        }
      }
}
