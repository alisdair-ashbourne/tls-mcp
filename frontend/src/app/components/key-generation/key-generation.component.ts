import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { PartyService } from '../../services/party.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-key-generation',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule,
    MatCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './key-generation.component.html',
  styleUrls: ['./key-generation.component.scss']
})
export class KeyGenerationComponent {
  sessionForm: FormGroup;
  partiesForm!: FormGroup;
  parties: number[] = [0, 1, 2];
  threshold = 3;
  totalParties = 3;
  thresholdOptions = [
    { label: '2 of 3', value: '2:3' },
    { label: '3 of 3', value: '3:3' },
    { label: '3 of 4', value: '3:4' },
    { label: '4 of 4', value: '4:4' },
  ];
  creating = false;
  sessionCreated = false;
  createdSessionId = '';

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private partyService: PartyService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.sessionForm = this.fb.group({
      operation: ['key_generation', Validators.required],
      description: [''],
      blockchain: ['ethereum'],
      thresholdScheme: ['3:3', Validators.required],
    });
    this.initPartiesForm(3);
  }

  onThresholdSchemeChange() {
    const scheme = this.sessionForm.get('thresholdScheme')?.value;
    if (!scheme) return;
    const [thresh, total] = scheme.split(':').map(Number);
    this.threshold = thresh;
    this.totalParties = total;
    this.parties = Array.from({ length: this.totalParties }, (_, i) => i);
    this.initPartiesForm(this.totalParties);
    this.updatePartyValidation();
  }

  initPartiesForm(count: number) {
    const group: any = {};
    for (let i = 0; i < count; i++) {
      group[`party${i}Name`] = [`Party ${String.fromCharCode(65 + i)}`, Validators.required];
      group[`party${i}Url`] = [`http://localhost:300${i + 1}/webhook`, [Validators.required, Validators.pattern('https?://.+')]];
      group[`party${i}Participate`] = [false];
    }
    this.partiesForm = this.fb.group(group);
  }

  private updatePartyValidation() {
    for (let i = 0; i < this.parties.length; i++) {
      const isParticipating = this.partiesForm.get(`party${i}Participate`)?.value;
      const urlControl = this.partiesForm.get(`party${i}Url`);
      
      if (isParticipating) {
        // Remove required validator for participating parties
        urlControl?.clearValidators();
        urlControl?.updateValueAndValidity();
      } else {
        // Add required validator for non-participating parties
        if (!urlControl?.hasValidator(Validators.required)) {
          urlControl?.setValidators([Validators.required, Validators.pattern('https?://.+')]);
          urlControl?.updateValueAndValidity();
        }
      }
    }
  }

  isPartiesFormValid(): boolean {
    // Check if all required fields are valid based on participation state
    for (let i = 0; i < this.parties.length; i++) {
      const nameControl = this.partiesForm.get(`party${i}Name`);
      const urlControl = this.partiesForm.get(`party${i}Url`);
      const participateControl = this.partiesForm.get(`party${i}Participate`);
      
      // Party name is always required
      if (nameControl?.invalid) {
        return false;
      }
      
      // URL is only required if party is not participating
      if (!participateControl?.value && urlControl?.invalid) {
        return false;
      }
    }
    return true;
  }

  async createSession() {
    if (this.sessionForm.invalid || !this.isPartiesFormValid()) {
      return;
    }
    this.creating = true;
    try {
      const participatingParty = this.getParticipatingParty();
      const parties = this.parties.map((_, i) => {
        const isParticipating = participatingParty && participatingParty.partyId === i;
        return {
          name: this.partiesForm.get(`party${i}Name`)?.value,
          webhookUrl: isParticipating 
            ? `browser://party-${i}`
            : this.partiesForm.get(`party${i}Url`)?.value
        };
      });
      const metadata = {
        description: this.sessionForm.get('description')?.value,
        blockchain: this.sessionForm.get('blockchain')?.value,
      };
      const sessionConfig = {
        operation: this.sessionForm.get('operation')?.value,
        parties,
        threshold: this.threshold,
        totalParties: this.totalParties,
        metadata
      };
      const response = await this.apiService.createSession(sessionConfig).toPromise();
      if (response) {
        this.createdSessionId = response.sessionId;
        this.sessionCreated = true;
        if (participatingParty) {
          await this.partyService.initializeAsParty(
            participatingParty.partyId,
            participatingParty.webhookUrl
          );
          this.snackBar.open(
            `Session created! You are now acting as Party ${participatingParty.partyId + 1}`, 
            'Close', 
            { duration: 5000 }
          );
        } else {
          this.snackBar.open(`Session ${response.sessionId} initialized successfully!`, 'Close', { duration: 3000 });
        }
      }
    } catch (error: any) {
      this.snackBar.open(`Failed to create session: ${error.message}`, 'Close', { duration: 5000 });
      console.error(error);
    } finally {
      this.creating = false;
    }
  }

  private getParticipatingParty(): { partyId: number; webhookUrl: string } | null {
    for (let i = 0; i < this.parties.length; i++) {
      if (this.partiesForm.get(`party${i}Participate`)?.value) {
        return {
          partyId: i,
          webhookUrl: `browser://party-${i}`
        };
      }
    }
    return null;
  }

  onPartyParticipationChange(partyIndex: number) {
    const isParticipating = this.partiesForm.get(`party${partyIndex}Participate`)?.value;
    const urlControl = this.partiesForm.get(`party${partyIndex}Url`);
    
    if (isParticipating) {
      // Set the party name to "Browser Party C" format
      const partyName = `Browser Party ${String.fromCharCode(67 + partyIndex)}`;
      this.partiesForm.get(`party${partyIndex}Name`)?.setValue(partyName);
      
      // Clear the webhook URL and remove required validator since it's not needed for browser parties
      urlControl?.setValue('');
      urlControl?.clearValidators();
      urlControl?.updateValueAndValidity();
    } else {
      // Reset to default party name
      const defaultName = `Party ${String.fromCharCode(65 + partyIndex)}`;
      this.partiesForm.get(`party${partyIndex}Name`)?.setValue(defaultName);
      
      // Reset to default webhook URL and add back required validator
      const defaultUrl = `http://localhost:300${partyIndex + 1}/webhook`;
      urlControl?.setValue(defaultUrl);
      urlControl?.setValidators([Validators.required, Validators.pattern('https?://.+')]);
      urlControl?.updateValueAndValidity();
    }
    
    // Update validation for all parties after making changes
    this.updatePartyValidation();
  }

  getPartyNamePlaceholder(partyIndex: number): string {
    const isParticipating = this.partiesForm.get(`party${partyIndex}Participate`)?.value;
    return isParticipating ? `Browser Party ${String.fromCharCode(67 + partyIndex)}` : 'e.g., Party A';
  }

  resetForm() {
    this.sessionForm.reset({
      operation: 'key_generation',
      description: '',
      blockchain: 'ethereum',
      thresholdScheme: '3:3',
    });
    this.onThresholdSchemeChange();
    this.sessionCreated = false;
    this.createdSessionId = '';
    this.updatePartyValidation();
  }
} 