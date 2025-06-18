import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class GenerateMultiplePasswords {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String password = "1234";
        
        System.out.println("Generating BCrypt hashes with strength 12 for password: " + password);
        System.out.println("--------------------------------------------------");
        
        // Generate 25 different hashes (since BCrypt generates different salts each time)
        for (int i = 1; i <= 25; i++) {
            String hash = encoder.encode(password);
            System.out.println("Hash " + i + ": " + hash);
            // Verify each hash
            if (!encoder.matches(password, hash)) {
                System.out.println("ERROR: Hash " + i + " verification failed!");
            }
        }
        
        System.out.println("--------------------------------------------------");
        System.out.println("All hashes verified successfully!");
        
        // Generate one specific hash for the SQL script
        String sqlHash = encoder.encode(password);
        System.out.println("\nFor SQL script use this hash:");
        System.out.println("'" + sqlHash + "'");
    }
} 
 
 