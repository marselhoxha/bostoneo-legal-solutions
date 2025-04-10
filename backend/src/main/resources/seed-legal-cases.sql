-- Clear existing data
DELETE FROM legal_cases;
ALTER TABLE legal_cases AUTO_INCREMENT = 1;

-- Insert realistic legal case data
INSERT INTO legal_cases (
    id, caseNumber, title, clientName, clientEmail, clientPhone, clientAddress,
    status, priority, type, description,
    courtName, judgeName, courtroom,
    filingDate, nextHearing, trialDate,
    hourlyRate, totalHours, totalAmount, paymentStatus,
    createdAt, updatedAt
) VALUES 
-- Case 1: Personal Injury
(1, 'BEO-2025-001', 'Martinez v. Boston General Hospital', 'Elena Martinez', 'e.martinez@example.com', '6175553421', '42 Maple Street, Cambridge, MA 02139',
 'OPEN', 'HIGH', 'PERSONAL_INJURY', 'Medical malpractice claim regarding improper medication administration resulting in severe allergic reaction. Patient suffered anaphylactic shock and was hospitalized for 8 days.',
 'Suffolk County Superior Court', 'Hon. William Chen', 'Courtroom 3B',
 '2025-02-15', '2025-05-22', '2025-10-15',
 350.00, 45.5, 15925.00, 'PENDING',
 NOW(), NOW()),

-- Case 2: Corporate Merger
(2, 'BEO-2025-002', 'TechVision-NovaSoft Merger', 'TechVision Inc.', 'legal@techvision.com', '6175559876', '1200 Technology Square, Cambridge, MA 02142',
 'IN_PROGRESS', 'URGENT', 'BUSINESS', 'Representing TechVision in $45M acquisition of NovaSoft. Due diligence focused on intellectual property assets and outstanding litigation.',
 NULL, NULL, NULL,
 '2025-01-10', '2025-04-28', '2025-07-15',
 425.00, 120.0, 51000.00, 'PAID',
 NOW(), NOW()),

-- Case 3: Divorce
(3, 'BEO-2025-003', 'Johnson Divorce Settlement', 'Robert Johnson', 'r.johnson@example.com', '6175557123', '89 Commonwealth Ave, Boston, MA 02116',
 'PENDING', 'MEDIUM', 'FAMILY', 'High-asset divorce involving division of property, retirement accounts, and child custody arrangements for two minor children, ages 8 and 11.',
 'Suffolk Probate and Family Court', 'Hon. Maria Garcia', 'Courtroom 2A',
 '2025-03-05', '2025-05-10', '2025-08-20',
 300.00, 35.0, 10500.00, 'PENDING',
 NOW(), NOW()),

-- Case 4: Criminal Defense
(4, 'BEO-2025-004', 'Commonwealth v. Williams', 'James Williams', 'jwilliams@example.com', '6175554892', '156 Beacon Street, Boston, MA 02116',
 'IN_PROGRESS', 'HIGH', 'CRIMINAL', 'Defense against felony embezzlement charges. Client accused of misappropriating $175,000 from employer over 2-year period.',
 'Suffolk County Criminal Court', 'Hon. Robert Blackwell', 'Courtroom 5C',
 '2025-02-28', '2025-04-15', '2025-09-30',
 375.00, 65.0, 24375.00, 'OVERDUE',
 NOW(), NOW()),

-- Case 5: Real Estate
(5, 'BEO-2025-005', 'Riverfront Development Project', 'Cambridge Properties LLC', 'legal@cambridgeproperties.com', '6175552345', '500 Boylston Street, Boston, MA 02116',
 'OPEN', 'MEDIUM', 'REAL_ESTATE', 'Zoning dispute regarding 15-acre mixed-use development project. Negotiating with city planning board for variance approvals.',
 'Cambridge Zoning Board of Appeals', 'Committee Chair Jane Franklin', 'City Hall Room 104',
 '2025-03-12', '2025-06-03', '2025-11-15',
 400.00, 85.5, 34200.00, 'PENDING',
 NOW(), NOW()),

-- Case 6: Employment Discrimination
(6, 'BEO-2025-006', 'Patterson v. Boston Financial', 'Alicia Patterson', 'a.patterson@example.com', '6175558765', '221 Baker Street, Brookline, MA 02445',
 'CLOSED', 'MEDIUM', 'EMPLOYMENT_LITIGATION', 'Gender discrimination and wrongful termination claim against financial services company. Settlement reached with confidentiality agreement.',
 'Massachusetts Commission Against Discrimination', 'Commissioner David Wong', 'Hearing Room A',
 '2024-11-15', '2025-02-10', '2025-06-15',
 375.00, 92.0, 34500.00, 'PAID',
 NOW(), NOW()),

-- Case 7: Immigration
(7, 'BEO-2025-007', 'Rodriguez Green Card Application', 'Carlos Rodriguez', 'c.rodriguez@example.com', '6175553698', '78 Washington Street, Somerville, MA 02143',
 'IN_PROGRESS', 'MEDIUM', 'IMMIGRATION', 'Employment-based green card application (EB-2) for software engineer with advanced degree. Responding to Request for Evidence from USCIS.',
 'USCIS Boston Field Office', NULL, NULL,
 '2025-01-22', '2025-05-14', '2025-09-10',
 280.00, 25.5, 7140.00, 'PAID',
 NOW(), NOW()),

-- Case 8: Intellectual Property
(8, 'BEO-2025-008', 'Quantum Computing Patent Infringement', 'Nexus Technologies Inc.', 'legal@nexustech.com', '6175556543', '88 Federal Street, Boston, MA 02110',
 'OPEN', 'HIGH', 'INTELLECTUAL_PROPERTY', 'Patent infringement claim regarding quantum computing algorithm. Seeking injunctive relief and damages for unauthorized use of patented technology.',
 'US District Court for the District of Massachusetts', 'Hon. Eleanor Simmons', 'Courtroom 7D',
 '2025-02-05', '2025-05-18', '2025-10-25',
 450.00, 110.0, 49500.00, 'PENDING',
 NOW(), NOW()),

-- Case 9: Estate Planning
(9, 'BEO-2025-009', 'Thompson Estate Plan', 'Margaret Thompson', 'm.thompson@example.com', '6175551234', '35 Pinehurst Road, Newton, MA 02459',
 'CLOSED', 'LOW', 'ESTATE_PLANNING', 'Comprehensive estate planning including will, revocable trust, power of attorney, and healthcare directive for high-net-worth individual.',
 NULL, NULL, NULL,
 '2025-01-08', '2025-03-20', '2025-04-15',
 325.00, 18.5, 6012.50, 'PAID',
 NOW(), NOW()),

-- Case 10: Bankruptcy
(10, 'BEO-2025-010', 'Coastal Restaurants Chapter 11', 'Coastal Restaurants Group', 'cfo@coastalrestaurants.com', '6175559012', '225 Northern Avenue, Boston, MA 02210',
 'IN_PROGRESS', 'URGENT', 'BANKRUPTCY', 'Chapter 11 reorganization for restaurant group with 6 locations and 120 employees. Negotiating with creditors and developing restructuring plan.',
 'US Bankruptcy Court, District of Massachusetts', 'Hon. Thomas Reynolds', 'Courtroom 2',
 '2025-02-22', '2025-05-05', '2025-08-15',
 400.00, 130.0, 52000.00, 'PENDING',
 NOW(), NOW()),

-- Case 11: Class Action
(11, 'BEO-2025-011', 'Consumer Privacy Data Breach', 'Sarah Chen (Lead Plaintiff)', 's.chen@example.com', '6175554567', '45 Walden Street, Cambridge, MA 02138',
 'OPEN', 'HIGH', 'CLASS_ACTION', 'Class action representing 12,500 consumers affected by data breach exposing personal and financial information. Seeking damages and improved security measures.',
 'US District Court for the District of Massachusetts', 'Hon. Michael Ortiz', 'Courtroom 9B',
 '2025-03-01', '2025-06-12', '2025-12-10',
 385.00, 175.0, 67375.00, 'PENDING',
 NOW(), NOW()),

-- Case 12: Environmental Litigation
(12, 'BEO-2025-012', 'Charles River Conservation v. Industrial Chemicals Inc.', 'Charles River Conservation Group', 'legal@crcg.org', '6175557890', '123 River Street, Cambridge, MA 02139',
 'OPEN', 'MEDIUM', 'ENVIRONMENTAL', 'Lawsuit regarding chemical discharge into Charles River watershed. Seeking remediation and compliance with Clean Water Act provisions.',
 'Massachusetts Environmental Court', 'Hon. Ellen Bradford', 'Courtroom 3',
 '2025-02-18', '2025-05-25', '2025-11-05',
 375.00, 85.0, 31875.00, 'PENDING',
 NOW(), NOW()),

-- Case 13: Personal Injury - Auto Accident
(13, 'BEO-2025-013', 'Patel v. Northeast Insurance', 'Ravi Patel', 'r.patel@example.com', '6175553456', '75 Highland Avenue, Somerville, MA 02143',
 'IN_PROGRESS', 'MEDIUM', 'PERSONAL_INJURY', 'Auto accident resulting in spinal injuries and $45,000 in medical expenses. Insurance company disputing liability percentage.',
 'Middlesex County Superior Court', 'Hon. Sandra Jenkins', 'Courtroom 4A',
 '2025-01-25', '2025-04-30', '2025-09-15',
 325.00, 38.5, 12512.50, 'PENDING',
 NOW(), NOW()),

-- Case 14: Contract Dispute
(14, 'BEO-2025-014', 'Atlantic Construction v. Boston Properties', 'Atlantic Construction Co.', 'legal@atlanticconstruction.com', '6175558901', '350 Congress Street, Boston, MA 02210',
 'PENDING', 'HIGH', 'CONTRACT', 'Breach of contract dispute regarding $2.3M office renovation project. Issues include project delays, change orders, and payment withholding.',
 'Suffolk County Business Court', 'Hon. Lawrence Freeman', 'Courtroom 3E',
 '2025-03-08', '2025-05-20', '2025-10-10',
 400.00, 65.0, 26000.00, 'OVERDUE',
 NOW(), NOW()),

-- Case 15: Tax Dispute
(15, 'BEO-2025-015', 'Wellington Tax Appeal', 'Wellington Investments LLC', 'tax@wellington.com', '6175552109', '280 Congress Street, Boston, MA 02210',
 'ARCHIVED', 'LOW', 'TAX', 'Property tax assessment appeal for commercial property valued at $12.5M. Successfully reduced assessment by 15% resulting in tax savings.',
 'Massachusetts Appellate Tax Board', 'Commissioner Richard Torres', 'Hearing Room C',
 '2024-10-15', '2025-01-20', '2025-03-15',
 375.00, 42.0, 15750.00, 'PAID',
 NOW(), NOW()); 