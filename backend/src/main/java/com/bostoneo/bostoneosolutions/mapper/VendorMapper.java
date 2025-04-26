package com.***REMOVED***.***REMOVED***solutions.mapper;

import com.***REMOVED***.***REMOVED***solutions.dto.VendorDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Vendor;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring")
public interface VendorMapper {
    
    @Mapping(target = "id", source = "id")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "contact", source = "contact")
    @Mapping(target = "taxId", source = "taxId")
    @Mapping(target = "createdAt", source = "createdAt")
    @Mapping(target = "updatedAt", source = "updatedAt")
    VendorDTO toVendorDTO(Vendor vendor);
    
    @Mapping(target = "id", source = "id")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "contact", source = "contact")
    @Mapping(target = "taxId", source = "taxId")
    @Mapping(target = "createdAt", source = "createdAt")
    @Mapping(target = "updatedAt", source = "updatedAt")
    Vendor toVendor(VendorDTO vendorDTO);
    
    @Named("toReference")
    default Vendor toReference(Long id) {
        if (id == null) {
            return null;
        }
        Vendor vendor = new Vendor();
        vendor.setId(id);
        return vendor;
    }
} 