import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AiResponseModalComponent } from '../components/ai-response-modal/ai-response-modal.component';

@Injectable({
  providedIn: 'root'
})
export class AiResponseModalService {
  constructor(private modalService: NgbModal) {}

  open(title: string, content: string, contextInfo?: any): NgbModalRef {
    const modalRef = this.modalService.open(AiResponseModalComponent, {
      size: 'xl',
      backdrop: 'static',
      keyboard: true,
      centered: true,
      scrollable: true
    });

    modalRef.componentInstance.title = title;
    modalRef.componentInstance.content = content;
    modalRef.componentInstance.contextInfo = contextInfo;

    return modalRef;
  }

  // Convenience methods for different practice areas
  openPropertyDivisionAnalysis(content: string, propertyData?: any): NgbModalRef {
    return this.open('Property Division Analysis', content, propertyData);
  }

  openChildSupportCalculation(content: string, calculationData?: any): NgbModalRef {
    return this.open('Child Support Calculation', content, calculationData);
  }

  openCustodyAgreement(content: string, agreementData?: any): NgbModalRef {
    return this.open('Custody Agreement', content, agreementData);
  }

  openAlimonyCalculation(content: string, alimonyData?: any): NgbModalRef {
    return this.open('Alimony Calculation', content, alimonyData);
  }

  openDivorceDocument(content: string, documentData?: any): NgbModalRef {
    return this.open('Divorce Document', content, documentData);
  }

  openMotionDraft(content: string, motionData?: any): NgbModalRef {
    return this.open('Motion Draft', content, motionData);
  }

  openSentencingCalculation(content: string, sentencingData?: any): NgbModalRef {
    return this.open('Sentencing Calculation', content, sentencingData);
  }

  openCaseAnalysis(content: string, caseData?: any): NgbModalRef {
    return this.open('Case Analysis', content, caseData);
  }

  openPleaAgreement(content: string, pleaData?: any): NgbModalRef {
    return this.open('Plea Agreement Analysis', content, pleaData);
  }

  openPurchaseAgreement(content: string, purchaseData?: any): NgbModalRef {
    return this.open('Purchase Agreement', content, purchaseData);
  }

  openLeaseAgreement(content: string, leaseData?: any): NgbModalRef {
    return this.open('Lease Agreement', content, leaseData);
  }

  openTitleReview(content: string, titleData?: any): NgbModalRef {
    return this.open('Title Review Analysis', content, titleData);
  }

  openDeedDraft(content: string, deedData?: any): NgbModalRef {
    return this.open('Deed Draft', content, deedData);
  }

  openClosingDocument(content: string, closingData?: any): NgbModalRef {
    return this.open('Closing Document', content, closingData);
  }

  openVisaPetition(content: string, visaData?: any): NgbModalRef {
    return this.open('Visa Petition', content, visaData);
  }

  openUSCISForm(content: string, formData?: any): NgbModalRef {
    return this.open('USCIS Form', content, formData);
  }

  openCaseStatusAnalysis(content: string, statusData?: any): NgbModalRef {
    return this.open('Case Status Analysis', content, statusData);
  }

  openDocumentChecklist(content: string, checklistData?: any): NgbModalRef {
    return this.open('Document Checklist', content, checklistData);
  }

  openTimelineCalculation(content: string, timelineData?: any): NgbModalRef {
    return this.open('Timeline Calculation', content, timelineData);
  }

  openPatentApplication(content: string, patentData?: any): NgbModalRef {
    return this.open('Patent Application', content, patentData);
  }

  openTrademarkSearch(content: string, trademarkData?: any): NgbModalRef {
    return this.open('Trademark Search Results', content, trademarkData);
  }

  openCopyrightRegistration(content: string, copyrightData?: any): NgbModalRef {
    return this.open('Copyright Registration', content, copyrightData);
  }

  openPriorArtSearch(content: string, priorArtData?: any): NgbModalRef {
    return this.open('Prior Art Search Results', content, priorArtData);
  }

  openLicenseAgreement(content: string, licenseData?: any): NgbModalRef {
    return this.open('License Agreement', content, licenseData);
  }

  // Personal Injury Practice Area Methods
  openCaseValueAnalysis(content: string, caseValueData?: any): NgbModalRef {
    return this.open('PI Case Value Analysis', content, caseValueData);
  }

  openDemandLetter(content: string, demandData?: any): NgbModalRef {
    return this.open('Personal Injury Demand Letter', content, demandData);
  }

  openMedicalChronology(content: string, medicalData?: any): NgbModalRef {
    return this.open('Medical Chronology', content, medicalData);
  }

  openSettlementAnalysis(content: string, settlementData?: any): NgbModalRef {
    return this.open('Settlement Analysis', content, settlementData);
  }
}