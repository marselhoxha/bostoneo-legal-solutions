package com.***REMOVED***.***REMOVED***solutions.dtomapper;

import com.***REMOVED***.***REMOVED***solutions.dto.VendorDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Vendor;
import org.springframework.beans.BeanUtils;

public class VendorDTOMapper {
    public static VendorDTO fromVendor(Vendor vendor) {
        VendorDTO vendorDTO = new VendorDTO();
        BeanUtils.copyProperties(vendor, vendorDTO);
        return vendorDTO;
    }

    public static Vendor toVendor(VendorDTO vendorDTO) {
        Vendor vendor = new Vendor();
        BeanUtils.copyProperties(vendorDTO, vendor);
        return vendor;
    }
} 