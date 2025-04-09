package com.bostoneo.bostoneosolutions.utils;

import com.twilio.Twilio;
import com.twilio.type.PhoneNumber;

import com.twilio.rest.api.v2010.account.Message;

import static com.twilio.rest.api.v2010.account.Message.creator;

public class SmsUtils {

    public static final String FROM_NUMBER= "+18886224307";
    public static final String SID_KEY= "AC52d9e9da057d49430f034c6a59a7e555";
    public static final String TOKEN_KEY= "271b9437b95141e522194f2e92cd3dba";

    public static void sendSMS(String to, String messageBody){
        Twilio.init(SID_KEY, TOKEN_KEY);
        Message message = creator(new PhoneNumber("+" + to), new PhoneNumber(FROM_NUMBER), messageBody).create();
        System.out.println(message);
    }
}
